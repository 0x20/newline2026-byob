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

camera.position.z = 30;

// Load header texture and create plane
const textureLoader = new THREE.TextureLoader();
let posterPlane;

textureLoader.load('img/poster2026bw4.png', (texture) => {
    const aspectRatio = texture.image.width / texture.image.height;
    const planeHeight = 20;
    const planeWidth = planeHeight * aspectRatio;

    const planeGeometry = new THREE.PlaneGeometry(planeWidth, planeHeight);
    const planeMaterial = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        opacity: 0.8,
        side: THREE.DoubleSide
    });

    posterPlane = new THREE.Mesh(planeGeometry, planeMaterial);
    posterPlane.position.z = -20;
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

        // Generate random yellow/red/orange tint - red always dominant to avoid green
        const r = 240 + Math.floor(Math.random() * 16); // 240-255 (always high red)
        const g = 120 + Math.floor(Math.random() * 121); // 120-240 (always <= red for warm tones)
        const b = 60 + Math.floor(Math.random() * 81); // 60-140 (keep low to stay warm)
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
const terrainGeometry = new THREE.PlaneGeometry(400, 400, 128, 128);
const terrainMaterial = new THREE.MeshStandardMaterial({
    color: 0xFFFFFF,
    roughness: 0.8,
    metalness: 0.1,
    flatShading: false,
    wireframe: true
});

const terrain = new THREE.Mesh(terrainGeometry, terrainMaterial);
terrain.rotation.x = -Math.PI / 2;
terrain.position.y = -15;
terrain.position.z = 15;

// Apply Perlin noise to terrain vertices
const positionAttribute = terrainGeometry.getAttribute('position');
for (let i = 0; i < positionAttribute.count; i++) {
    const x = positionAttribute.getX(i);
    const y = positionAttribute.getY(i);

    let height = 0;
    let amplitude = 18;
    let frequency = 0.005;

    // Multiple octaves for more natural terrain
    for (let octave = 0; octave < 4; octave++) {
        height += perlin.noise(x * frequency, y * frequency, 0) * amplitude;
        amplitude *= 0.5;
        frequency *= 2;
    }

    positionAttribute.setZ(i, height);
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



// Mouse interaction
const mouse = new THREE.Vector2();
const raycaster = new THREE.Raycaster();

window.addEventListener('mousemove', (event) => {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
});

// Animation loop
let time = 0;
let envMapUpdated = false;

function animate() {
    requestAnimationFrame(animate);
    time += 0.01;
    
    // Update bubbles
    bubbles.forEach(bubble => bubble.update(time));

    // Mouse interaction - gentle repulsion
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(bubbles.map(b => b.mesh));

    if (intersects.length > 0) {
        const bubble = bubbles.find(b => b.mesh === intersects[0].object);
        if (bubble) {
            const direction = new THREE.Vector3()
                .subVectors(bubble.mesh.position, intersects[0].point)
                .normalize()
                .multiplyScalar(0.1);
            bubble.mesh.position.add(direction);
        }
    }

    renderer.render(scene, camera);
}

// Handle window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();
