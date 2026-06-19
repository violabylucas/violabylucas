export async function mountAboutAsciiObject(root) {
  if (!root) return () => {};

  const [THREE, { OrbitControls }, { AsciiEffect }] = await Promise.all([
    import("three"),
    import("three/addons/controls/OrbitControls.js"),
    import("three/addons/effects/AsciiEffect.js")
  ]);

  const scene = new THREE.Scene();
  scene.background = null;

  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
  camera.position.set(0, 0.05, 6.2);

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: "high-performance"
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setClearColor(0x000000, 0);

  const effect = new AsciiEffect(renderer, " .,:-+*#", {
    invert: false,
    color: false,
    alpha: false,
    block: false,
    resolution: 0.25
  });

  function clearAsciiBackground() {
    effect.domElement.style.background = "transparent";
    effect.domElement.style.backgroundColor = "transparent";
    effect.domElement.style.border = "0";
    effect.domElement.style.boxShadow = "none";
    effect.domElement.style.color = "rgba(255,255,255,0.82)";
    effect.domElement.style.pointerEvents = "auto";
    effect.domElement.style.margin = "0";

    const table = effect.domElement.querySelector("table");
    const tbody = effect.domElement.querySelector("tbody");
    const tr = effect.domElement.querySelector("tr");
    const td = effect.domElement.querySelector("td");

    if (table) {
      table.style.background = "transparent";
      table.style.backgroundColor = "transparent";
      table.style.borderCollapse = "collapse";
      table.style.border = "0";
      table.style.boxShadow = "none";
    }

    if (tbody) {
      tbody.style.background = "transparent";
      tbody.style.backgroundColor = "transparent";
      tbody.style.border = "0";
      tbody.style.boxShadow = "none";
    }

    if (tr) {
      tr.style.background = "transparent";
      tr.style.backgroundColor = "transparent";
      tr.style.border = "0";
      tr.style.boxShadow = "none";
    }

    if (td) {
      td.style.background = "transparent";
      td.style.backgroundColor = "transparent";
      td.style.border = "0";
      td.style.boxShadow = "none";
    }
  }

  root.innerHTML = "";
  root.style.background = "transparent";
  root.style.backgroundColor = "transparent";
  root.appendChild(effect.domElement);

  const ambient = new THREE.AmbientLight(0xffffff, 0.8);
  scene.add(ambient);

  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(3.2, 2.4, 4.8);
  scene.add(key);

  const rim = new THREE.DirectionalLight(0xffffff, 0.55);
  rim.position.set(-3.5, -1.8, -2.8);
  scene.add(rim);

  const group = new THREE.Group();
  scene.add(group);

  const sphereGeometry = new THREE.SphereGeometry(1.55, 40, 28);
  const sphereMaterial = new THREE.MeshPhongMaterial({
    color: 0xffffff,
    flatShading: true
  });

  const mesh = new THREE.Mesh(sphereGeometry, sphereMaterial);
  mesh.rotation.x = 0.18;
  group.add(mesh);

  const sparkleGroup = new THREE.Group();
  group.add(sparkleGroup);

  function makeSparkleTexture() {
    const size = 64;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;

    const ctx = canvas.getContext("2d");
    const gradient = ctx.createRadialGradient(
      size * 0.5,
      size * 0.5,
      0,
      size * 0.5,
      size * 0.5,
      size * 0.5
    );

    gradient.addColorStop(0, "rgba(255,255,255,1)");
    gradient.addColorStop(0.25, "rgba(255,255,255,0.95)");
    gradient.addColorStop(0.55, "rgba(255,255,255,0.35)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }

  const sparkleTexture = makeSparkleTexture();
  const sparkleMaterial = new THREE.SpriteMaterial({
    map: sparkleTexture,
    color: 0xffffff,
    transparent: true,
    opacity: 0.95,
    depthWrite: false
  });

  const sparkles = [];
  const sparkleCount = 14;
  const sparkleRadius = 1.78;

  for (let i = 0; i < sparkleCount; i += 1) {
    const sprite = new THREE.Sprite(sparkleMaterial.clone());

    const phi = Math.acos(1 - 2 * ((i + 0.5) / sparkleCount));
    const theta = i * 2.399963229728653;

    const x = sparkleRadius * Math.sin(phi) * Math.cos(theta);
    const y = sparkleRadius * Math.cos(phi);
    const z = sparkleRadius * Math.sin(phi) * Math.sin(theta);

    sprite.position.set(x, y, z);

    const baseScale = 0.16 + (i % 4) * 0.02;
    sprite.scale.setScalar(baseScale);

    sparkleGroup.add(sprite);

    sparkles.push({
      sprite,
      baseScale,
      phase: i * 0.9,
      speed: 0.8 + (i % 5) * 0.17,
      drift: 0.015 + (i % 3) * 0.01
    });
  }

    const originalReleasePointerCapture = root.releasePointerCapture?.bind(root);

    if (originalReleasePointerCapture) {
    root.releasePointerCapture = (pointerId) => {
        try {
        if (root.hasPointerCapture && root.hasPointerCapture(pointerId)) {
            originalReleasePointerCapture(pointerId);
        }
        } catch {}
    };
    }

  const controls = new OrbitControls(camera, effect.domElement);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.minDistance = 4.5;
  controls.maxDistance = 8;
  controls.autoRotate = false;

  let disposed = false;
  let frameId = 0;
  let userActiveUntil = 0;

  controls.addEventListener("start", () => {
    userActiveUntil = performance.now() + 2200;
  });

    function resize() {
    const width = Math.floor(root.clientWidth);
    const height = Math.floor(root.clientHeight);

    if (width <= 0 || height <= 0) return false;

    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    effect.setSize(width, height);
    clearAsciiBackground();
    return true;
    }

function animate(time) {
  if (disposed) return;

  const width = Math.floor(root.clientWidth);
  const height = Math.floor(root.clientHeight);

  if (width <= 0 || height <= 0) {
    frameId = requestAnimationFrame(animate);
    return;
  }

  const t = time * 0.001;

  if (performance.now() > userActiveUntil) {
    group.rotation.y += 0.004;
  }

  group.rotation.z = Math.sin(t * 0.7) * 0.05;
  mesh.rotation.x = 0.18 + Math.sin(t * 1.1) * 0.08;

  sparkleGroup.rotation.y -= 0.006;
  sparkleGroup.rotation.x = Math.sin(t * 0.9) * 0.14;

  for (const sparkle of sparkles) {
    const pulse = 0.45 + 0.55 * Math.sin(t * (3.5 * sparkle.speed) + sparkle.phase);
    const flicker = Math.sin(t * (12 + sparkle.phase * 0.7)) > 0.82 ? 1 : 0.35;
    const opacity = Math.max(0.08, pulse * flicker);
    const scale = sparkle.baseScale * (0.75 + pulse * 0.9);

    sparkle.sprite.material.opacity = opacity;
    sparkle.sprite.scale.setScalar(scale);

    sparkle.sprite.position.multiplyScalar(
      1 + Math.sin(t * sparkle.speed + sparkle.phase) * sparkle.drift
    );
    sparkle.sprite.position.normalize().multiplyScalar(sparkleRadius);
  }

  key.intensity = 1.9 + Math.sin(t * 3.2) * 0.18;

  controls.update();
  effect.render(scene, camera);
  clearAsciiBackground();

  frameId = requestAnimationFrame(animate);
}

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(root);
    resize();
    frameId = requestAnimationFrame(animate);

  return () => {
    disposed = true;
    cancelAnimationFrame(frameId);
    resizeObserver.disconnect();
    controls.dispose();
    sphereGeometry.dispose();
    sphereMaterial.dispose();
    sparkleTexture.dispose();
    for (const sparkle of sparkles) {
      sparkle.sprite.material.dispose();
    }
    renderer.dispose();
    root.innerHTML = "";
  };
}