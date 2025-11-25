import * as THREE from 'three';
import { ImprovedNoise } from 'three/addons/math/ImprovedNoise.js';

// Scene setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true
});

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
document.getElementById('canvas-container').appendChild(renderer.domElement);

// camera.position.z = 200;
// camera.position.y = 100;
camera.rotation.order = 'YXZ';

// Flying controls setup
const playerVelocity = new THREE.Vector3();
const playerDirection = new THREE.Vector3();
const keyStates = {};

document.addEventListener('keydown', (event) => {
    keyStates[event.code] = true;
});

document.addEventListener('keyup', (event) => {
    keyStates[event.code] = false;
});

document.body.addEventListener('click', () => {
    document.body.requestPointerLock();
});

document.body.addEventListener('mousemove', (event) => {
    if (document.pointerLockElement === document.body) {
        camera.rotation.y -= event.movementX / 500;
        camera.rotation.x -= event.movementY / 500;
        camera.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, camera.rotation.x));
    }
});

function getForwardVector() {
    camera.getWorldDirection(playerDirection);
    playerDirection.normalize();
    return playerDirection;
}

function getSideVector() {
    camera.getWorldDirection(playerDirection);
    playerDirection.normalize();
    playerDirection.cross(camera.up);
    return playerDirection;
}

function controls(deltaTime) {
    const speedDelta = deltaTime * 1000;

    if (keyStates['KeyW']) {
        playerVelocity.add(getForwardVector().multiplyScalar(speedDelta));
    }

    if (keyStates['KeyS']) {
        playerVelocity.add(getForwardVector().multiplyScalar(-speedDelta));
    }

    if (keyStates['KeyA']) {
        playerVelocity.add(getSideVector().multiplyScalar(-speedDelta));
    }

    if (keyStates['KeyD']) {
        playerVelocity.add(getSideVector().multiplyScalar(speedDelta));
    }

    if (keyStates['Space']) {
        playerVelocity.y += speedDelta;
    }

    if (keyStates['ShiftLeft'] || keyStates['ShiftRight']) {
        playerVelocity.y -= speedDelta;
    }
}

function updatePlayer(deltaTime) {
    const damping = Math.exp(-4 * deltaTime) - 1;
    playerVelocity.addScaledVector(playerVelocity, damping);
    const deltaPosition = playerVelocity.clone().multiplyScalar(deltaTime);
    camera.position.add(deltaPosition);
}

// Load header texture and create plane
const textureLoader = new THREE.TextureLoader();

textureLoader.load('img/poster2026bw4.png', (texture) => {
    // Enable anisotropic filtering for smoother edges
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();

    const aspectRatio = texture.image.width / texture.image.height;
    const planeHeight = 20;
    const planeWidth = planeHeight * aspectRatio;

    const planeGeometry = new THREE.PlaneGeometry(planeWidth, planeHeight);
    const planeMaterial = new THREE.MeshStandardMaterial({
        map: texture,
        side: THREE.DoubleSide,
        emissive: 0xffffff,
        emissiveMap: texture,
        emissiveIntensity: 0.8,
        alphaTest: 0.1,
        transparent: false
    });

    const posterPlane = new THREE.Mesh(planeGeometry, planeMaterial);
    posterPlane.position.z = -15;
    posterPlane.position.y = 0;
    scene.add(posterPlane);
});

// Lighting - bright saturated colors
const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 2);
directionalLight.position.set(5, 5, 5);
scene.add(directionalLight);

const pointLight1 = new THREE.PointLight(0xFF4500, 3, 100);
pointLight1.position.set(-10, 10, 10);
scene.add(pointLight1);

const pointLight2 = new THREE.PointLight(0xFFD700, 3, 100);
pointLight2.position.set(10, -10, 10);
scene.add(pointLight2);

const pointLight3 = new THREE.PointLight(0xFF1493, 2.5, 100);
pointLight3.position.set(0, 0, 20);
scene.add(pointLight3);

// Create environment map for bubble refraction
const cubeRenderTarget = new THREE.WebGLCubeRenderTarget(512);
const cubeCamera = new THREE.CubeCamera(0.1, 1000, cubeRenderTarget);
scene.add(cubeCamera);

// Bubble class
class Bubble {
    constructor(radius, position) {
        const geometry = new THREE.SphereGeometry(radius, 64, 64);

        // Generate random light blue to purple tint
        const r = 173 + Math.floor(Math.random() * 83); // 173-255 (light blue to purple range)
        const g = 144 + Math.floor(Math.random() * 72); // 144-215 (medium values)
        const b = 216 + Math.floor(Math.random() * 40); // 216-255 (always high for blue/purple)
        const tintedColor = (r << 16) | (g << 8) | b;

        // Create iridescent bubble material
        const material = new THREE.MeshPhysicalMaterial({
            color: tintedColor,
            transmission: 0.95,
            roughness: 0,
            metalness: 0,
            ior: 1.35,
            thickness: 0.5,
            transparent: true,
            opacity: 0.5,
            clearcoat: 1,
            clearcoatRoughness: 0,
            iridescence: 1,
            iridescenceIOR: 1.3,
            iridescenceThicknessRange: [100, 400],
            side: THREE.DoubleSide,
            envMap: cubeRenderTarget.texture,
            envMapIntensity: 1
        });

        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.copy(position);

        // Random velocity for floating
        this.velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 0.02,
            (Math.random() - 0.5) * 0.02,
            (Math.random() - 0.5) * 0.02
        );

        // Random rotation speeds
        this.rotationSpeed = new THREE.Vector3(
            (Math.random() - 0.5) * 0.01,
            (Math.random() - 0.5) * 0.01,
            (Math.random() - 0.5) * 0.01
        );

        // Float parameters
        this.floatOffset = Math.random() * Math.PI * 2;
        this.floatSpeed = 0.5 + Math.random() * 0.5;
        this.floatAmplitude = 0.5 + Math.random() * 1;

        scene.add(this.mesh);
    }

    update(time) {
        // Floating motion
        this.mesh.position.y += Math.sin(time * this.floatSpeed + this.floatOffset) * 0.01 * this.floatAmplitude;
        this.mesh.position.x += Math.cos(time * this.floatSpeed * 0.7 + this.floatOffset) * 0.008 * this.floatAmplitude;

        // Gentle drift
        this.mesh.position.add(this.velocity);

        // Rotation
        this.mesh.rotation.x += this.rotationSpeed.x;
        this.mesh.rotation.y += this.rotationSpeed.y;
        this.mesh.rotation.z += this.rotationSpeed.z;

        // Boundary checking - wrap around
        const bounds = 40;
        if (Math.abs(this.mesh.position.x) > bounds) this.mesh.position.x *= -0.8;
        if (Math.abs(this.mesh.position.y) > bounds) this.mesh.position.y *= -0.8;
        if (Math.abs(this.mesh.position.z) > bounds) this.mesh.position.z *= -0.8;
    }
}

// Create white terrain with Perlin noise
const perlin = new ImprovedNoise();

// Reusable function to calculate terrain height at any x,z position
function getTerrainHeight(x, z) {
    let height = 0;
    let amplitude = 18;
    let frequency = 0.005;

    // Multiple octaves for more natural terrain
    for (let octave = 0; octave < 4; octave++) {
        height += perlin.noise(x * frequency, z * frequency, 0) * amplitude;
        amplitude *= 0.5;
        frequency *= 2;
    }

    return height;
}

const terrainGeometry = new THREE.PlaneGeometry(400, 400, 128, 128);
const terrainMaterial = new THREE.MeshStandardMaterial({
    color: 0x116B11,
    roughness: 0.8,
    metalness: 0.2,
    flatShading: false,
    wireframe: false
});

const terrain = new THREE.Mesh(terrainGeometry, terrainMaterial);
terrain.rotation.x = -Math.PI / 2;
terrain.position.y = -15;
terrain.position.z = 0;

// Apply Perlin noise to terrain vertices
const positionAttribute = terrainGeometry.getAttribute('position');
for (let i = 0; i < positionAttribute.count; i++) {
    const x = positionAttribute.getX(i);
    const y = positionAttribute.getY(i);
    positionAttribute.setZ(i, getTerrainHeight(x, y));
}

positionAttribute.needsUpdate = true;
terrainGeometry.computeVertexNormals();
scene.add(terrain);

// Create bubbles
const bubbles = [];
const bubbleCount = 25;

for (let i = 0; i < bubbleCount; i++) {
    const radius = 0.5 + Math.random() * 2.5;
    const position = new THREE.Vector3(
        (Math.random() - 0.5) * 60,
        (Math.random() - 0.5) * 40,
        (Math.random() - 0.5) * 40 - 10
    );
    bubbles.push(new Bubble(radius, position));
}

// Create grass using InstancedMesh
const grassCount = 100000;
const grassGeometry = new THREE.PlaneGeometry(1.0, 1.3);
// Translate geometry so pivot is at bottom instead of center
grassGeometry.translate(0, 0.65, 0);
const grassTexture = textureLoader.load('img/icons/grass-green2.png');
grassTexture.colorSpace = THREE.SRGBColorSpace;

const grassMaterial = new THREE.MeshStandardMaterial({
    map: grassTexture,
    transparent: true,
    alphaTest: 0.5,
    side: THREE.DoubleSide,
    roughness: 0.8,
    metalness: 0.1
});

const grassMesh = new THREE.InstancedMesh(grassGeometry, grassMaterial, grassCount);
grassMesh.castShadow = true;
grassMesh.receiveShadow = true;

// Position grass instances across the terrain
const dummy = new THREE.Object3D();
const grassInstances = [];

for (let i = 0; i < grassCount; i++) {
    // Random position across full terrain area (400x400)
    const x = (Math.random() - 0.5) * 400;
    const z = (Math.random()) * -200;

    // Calculate height from terrain using the reusable function
    // Terrain is rotated -90° around X, so geometry Y = -world Z
    const y = -15 + getTerrainHeight(x, -z);

    // Position and randomize
    const rotationY = Math.random() * Math.PI * 2;
    const scale = 1.6 + Math.random() * 0.8;

    dummy.position.set(x, y, z);
    dummy.rotation.set(0, rotationY, 0);
    dummy.scale.set(scale, scale, scale);

    dummy.updateMatrix();
    grassMesh.setMatrixAt(i, dummy.matrix);

    // Store data for animation
    grassInstances.push({
        index: i,
        x: x,
        y: y,
        z: z,
        rotationY: rotationY,
        scale: scale,
        phase: Math.random() * Math.PI * 2,
        speed: 0.5 + Math.random() * 0.5
    });
}

scene.add(grassMesh);

// Animation loop
let time = 0;
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    const deltaTime = Math.min(0.05, clock.getDelta());
    time += 0.01;

    // Update flying controls
    controls(deltaTime);
    updatePlayer(deltaTime);

    // Update bubbles
    bubbles.forEach(bubble => bubble.update(time));

    // Animate grass with gentle swaying
    grassInstances.forEach(grass => {
        const swayAmount = Math.sin(time * grass.speed + grass.phase) * 0.15;

        dummy.position.set(grass.x, grass.y, grass.z);
        dummy.rotation.set(swayAmount, grass.rotationY, 0);
        dummy.scale.set(grass.scale, grass.scale, grass.scale);

        dummy.updateMatrix();
        grassMesh.setMatrixAt(grass.index, dummy.matrix);
    });
    grassMesh.instanceMatrix.needsUpdate = true;

    renderer.render(scene, camera);
}

// Handle window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();
