"use client";

import React, { useEffect, useRef } from "react";
import * as THREE from "three";

interface FloatingOrbProps {
  className?: string;
  size?: number;
}

/**
 * Floating 3D Orb Component
 * Renders an interactive, liquid-iridescent glass orb floating directly against the background
 * with transparent canvas, multi-axis organic rotation, Fresnel lighting, and subtle mouse parallax.
 */
export const FloatingOrb: React.FC<FloatingOrbProps> = ({
  className = "",
  size = 320,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Check for reduced motion preference
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    // Scene setup
    const scene = new THREE.Scene();

    // Camera setup
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.z = 3.6;

    // WebGLRenderer setup with alpha for completely transparent background
    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(size, size);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    rendererRef.current = renderer;

    container.appendChild(renderer.domElement);

    // Custom Shader for Liquid-Iridescent Glass Core
    const vertexShader = `
      varying vec3 vNormal;
      varying vec3 vPosition;
      varying vec3 vViewPosition;
      varying vec2 vUv;
      uniform float uTime;

      // Classic Perlin 3D Noise snippet
      vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
      vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}
      
      float snoise(vec3 v){
        const vec2  C = vec2(1.0/6.0, 1.0/3.0);
        const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);
        vec3 i  = floor(v + dot(v, C.yyy));
        vec3 x0 = v - i + dot(i, C.xxx);
        vec3 g = step(x0.yzx, x0.xyz);
        vec3 l = 1.0 - g;
        vec3 i1 = min(g.xyz, l.zxy);
        vec3 i2 = max(g.xyz, l.zxy);
        vec3 x1 = x0 - i1 + 1.0 * C.xxx;
        vec3 x2 = x0 - i2 + 2.0 * C.xxx;
        vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;
        i = mod(i, 289.0);
        vec4 p = permute(permute(permute(
                  i.z + vec4(0.0, i1.z, i2.z, 1.0))
                + i.y + vec4(0.0, i1.y, i2.y, 1.0))
                + i.x + vec4(0.0, i1.x, i2.x, 1.0));
        float n_ = 0.142857142857;
        vec3 ns = n_ * D.wyz - D.xzx;
        vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
        vec4 x_ = floor(j * ns.z);
        vec4 y_ = floor(j - 7.0 * x_);
        vec4 x = x_ *ns.x + ns.yyyy;
        vec4 y = y_ *ns.x + ns.yyyy;
        vec4 h = 1.0 - abs(x) - abs(y);
        vec4 b0 = vec4(x.xy, y.xy);
        vec4 b1 = vec4(x.zw, y.zw);
        vec4 s0 = floor(b0)*2.0 + 1.0;
        vec4 s1 = floor(b1)*2.0 + 1.0;
        vec4 sh = -step(h, vec4(0.0));
        vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
        vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
        vec3 p0 = vec3(a0.xy, h.x);
        vec3 p1 = vec3(a0.zw, h.y);
        vec3 p2 = vec3(a1.xy, h.z);
        vec3 p3 = vec3(a1.zw, h.w);
        vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
        p0 *= norm.x;
        p1 *= norm.y;
        p2 *= norm.z;
        p3 *= norm.w;
        vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
        m = m * m;
        return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
      }

      void main() {
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
        
        // Subtle organic surface wave distortion
        float displacement = snoise(position * 1.8 + vec3(uTime * 0.28)) * 0.045;
        vec3 newPosition = position + normal * displacement;
        
        vec4 mvPosition = modelViewMatrix * vec4(newPosition, 1.0);
        vPosition = (modelMatrix * vec4(newPosition, 1.0)).xyz;
        vViewPosition = -mvPosition.xyz;
        gl_Position = projectionMatrix * mvPosition;
      }
    `;

    const fragmentShader = `
      varying vec3 vNormal;
      varying vec3 vPosition;
      varying vec3 vViewPosition;
      varying vec2 vUv;
      uniform float uTime;
      uniform vec2 uMouse;

      void main() {
        vec3 normal = normalize(vNormal);
        vec3 viewDir = normalize(vViewPosition);

        // Fresnel reflection factor
        float fresnel = dot(normal, viewDir);
        fresnel = clamp(1.0 - fresnel, 0.0, 1.0);
        float fresnelGlow = pow(fresnel, 2.8);
        float edgeRim = pow(fresnel, 5.0);

        // Liquid core motion
        float swirl1 = sin(normal.x * 4.2 + uTime * 0.75) * cos(normal.y * 3.8 + uTime * 0.65);
        float swirl2 = cos(normal.z * 5.1 + uTime * 0.85) * sin(normal.x * 4.0 - uTime * 0.45);

        // Sophisticated liquid iridescent color palette
        vec3 deepNavy = vec3(0.015, 0.04, 0.12);
        vec3 electricCyan = vec3(0.0, 0.82, 1.0);
        vec3 vividViolet = vec3(0.48, 0.15, 0.95);
        vec3 hotMagenta = vec3(0.92, 0.2, 0.85);
        vec3 brightGlowWhite = vec3(0.95, 0.98, 1.0);

        // Dynamic gradient blending inside the liquid core
        float mixFactor1 = smoothstep(-0.6, 0.8, swirl1 + normal.y * 0.6);
        float mixFactor2 = smoothstep(-0.5, 0.7, swirl2 + normal.x * 0.5);

        vec3 coreColor = mix(deepNavy, electricCyan, mixFactor1);
        coreColor = mix(coreColor, vividViolet, mixFactor2 * 0.85);
        coreColor = mix(coreColor, hotMagenta, pow(fresnel, 1.8) * 0.45);

        // Rim lighting with electric blue & cyan reflections
        vec3 rimColor = mix(electricCyan, brightGlowWhite, edgeRim);
        vec3 finalColor = coreColor + (vividViolet * fresnelGlow * 1.4) + (rimColor * edgeRim * 1.8);

        // Specular highlight from top-light
        vec3 lightDir = normalize(vec3(0.8, 1.2, 1.0));
        vec3 halfVector = normalize(lightDir + viewDir);
        float NdotH = max(dot(normal, halfVector), 0.0);
        float specular = pow(NdotH, 48.0) * 0.75;
        finalColor += vec3(1.0) * specular;

        // Subtle alpha transparency for genuine floating glass look
        float alpha = clamp(0.72 + (fresnel * 0.28) + (specular * 0.3), 0.0, 1.0);

        gl_FragColor = vec4(finalColor, alpha);
      }
    `;

    // High polygon sphere geometry for smooth curvature
    const geometry = new THREE.SphereGeometry(1.15, 128, 128);

    const uniforms = {
      uTime: { value: 0 },
      uMouse: { value: new THREE.Vector2(0, 0) },
    };

    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms,
      transparent: true,
      depthWrite: true,
      blending: THREE.NormalBlending,
    });

    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    // Inner subtle glow point light
    const pointLight = new THREE.PointLight(0x00d4ff, 2.5, 10);
    pointLight.position.set(0, 0, 0.5);
    scene.add(pointLight);

    // Mouse interaction for subtle parallax
    let targetMouseX = 0;
    let targetMouseY = 0;
    let currentMouseX = 0;
    let currentMouseY = 0;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      targetMouseX = x * 0.25;
      targetMouseY = y * 0.25;
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });

    // Animation Loop
    let clock = new THREE.Clock();

    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate);

      const elapsedTime = clock.getElapsedTime();
      uniforms.uTime.value = elapsedTime;

      // Mouse smoothing
      currentMouseX += (targetMouseX - currentMouseX) * 0.05;
      currentMouseY += (targetMouseY - currentMouseY) * 0.05;

      if (!prefersReducedMotion) {
        // Multi-axis organic 3D rotation
        mesh.rotation.y = elapsedTime * 0.22 + currentMouseX;
        mesh.rotation.x = Math.sin(elapsedTime * 0.18) * 0.35 + currentMouseY;
        mesh.rotation.z = Math.cos(elapsedTime * 0.15) * 0.2;
      }

      renderer.render(scene, camera);
    };

    animate();

    // Cleanup on component unmount
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
      }
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      if (container && renderer.domElement) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [size]);

  return (
    <div
      ref={containerRef}
      className={`relative flex items-center justify-center overflow-visible select-none pointer-events-none ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    />
  );
};

