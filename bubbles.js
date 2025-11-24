import * as THREE from 'three';
import { ImprovedNoise } from 'three/addons/math/ImprovedNoise.js';
import { EffectComposer, RenderPass } from 'postprocessing';
import { GodraysPass } from 'https://unpkg.com/three-good-godrays@0.7.1/build/three-good-godrays.esm.js';

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
renderer.toneMappingExposure = 1.8;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = true;
document.getElementById('canvas-container').appendChild(renderer.domElement);

camera.position.z = 0;

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
    posterPlane.castShadow = true;
    posterPlane.receiveShadow = true;
    scene.add(posterPlane);
});

// Create sun
const sunPosition = new THREE.Vector3(-30, 20, 15);
const sunGeometry = new THREE.SphereGeometry(8, 32, 32);
const sunMaterial = new THREE.MeshBasicMaterial({
    color: 0xFFFFAA
});
const sun = new THREE.Mesh(sunGeometry, sunMaterial);
sun.position.copy(sunPosition);
sun.castShadow = true;
sun.receiveShadow = false;
scene.add(sun);

// Add sun glow
const glowGeometry = new THREE.SphereGeometry(12, 32, 32);
const glowMaterial = new THREE.MeshBasicMaterial({
    color: 0xFFDD88,
    transparent: true,
    opacity: 0.3
});
const sunGlow = new THREE.Mesh(glowGeometry, glowMaterial);
sunGlow.position.copy(sunPosition);
sunGlow.castShadow = true;
sunGlow.receiveShadow = false;
scene.add(sunGlow);

// Lighting - bright saturated colors
const ambientLight = new THREE.AmbientLight(0xffffff, 2.5);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xFFFFFF, 6);
directionalLight.position.copy(sunPosition);
directionalLight.target.position.set(0, 0, 0);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 2048;
directionalLight.shadow.mapSize.height = 2048;
directionalLight.shadow.camera.near = 0.5;
directionalLight.shadow.camera.far = 500;
directionalLight.shadow.camera.left = -100;
directionalLight.shadow.camera.right = 100;
directionalLight.shadow.camera.top = 100;
directionalLight.shadow.camera.bottom = -100;
scene.add(directionalLight);
scene.add(directionalLight.target);

const pointLight1 = new THREE.PointLight(0x00CED1, 2, 100); // Cyan
pointLight1.position.set(-10, 10, 10);
scene.add(pointLight1);

const pointLight2 = new THREE.PointLight(0x4FC3F7, 2, 100); // Sky blue
pointLight2.position.set(10, -10, 10);
scene.add(pointLight2);

const pointLight3 = new THREE.PointLight(0x81D4FA, 1.5, 100); // Light blue
pointLight3.position.set(0, 0, 20);
scene.add(pointLight3);

// God rays will be added via post-processing with three-good-godrays

// Create environment map for bubble refraction
const cubeRenderTarget = new THREE.WebGLCubeRenderTarget(512);
const cubeCamera = new THREE.CubeCamera(0.1, 1000, cubeRenderTarget);
scene.add(cubeCamera);

// Bubble class
class Bubble {
    constructor(radius, position) {
        const geometry = new THREE.SphereGeometry(radius, 64, 64);

        // Generate random blueish tint - like real soap bubbles
        const r = 180 + Math.floor(Math.random() * 50); // 180-230 (medium-high red)
        const g = 220 + Math.floor(Math.random() * 36); // 220-255 (high green)
        const b = 240 + Math.floor(Math.random() * 16); // 240-255 (always high blue)
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
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;

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
    color: 0x66BB6A,
    emissive: 0x4CAF50,
    emissiveIntensity: 0.5,
    roughness: 0.05,
    metalness: 0.95,
    flatShading: true,
    wireframe: false
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
terrain.castShadow = true;
terrain.receiveShadow = true;
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

// Set up post-processing with god rays
const composer = new EffectComposer(renderer);

const godraysPass = new GodraysPass(directionalLight, camera, {
    density: 1/300,
    maxDensity: 0.25,
    edgeStrength: 15,
    edgeRadius: 1,
    distanceAttenuation: 3,
    color: new THREE.Color(0xFFFFFF),
    raymarchSteps: 100,
    blur: false,
    gammaCorrection: true
});
composer.addPass(new RenderPass(scene, camera));
composer.addPass(godraysPass);

// Animation loop
let time = 0;

function animate() {
    requestAnimationFrame(animate);
    time += 0.01;

    // Update bubbles
    bubbles.forEach(bubble => bubble.update(time));

    composer.render();
}

// Handle window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
});

animate();
