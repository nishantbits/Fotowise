import React, { useState, useEffect, useRef, useMemo, useCallback, Suspense } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Canvas, useFrame } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { X, Image as ImageIcon, Loader2, HardDrive, Users, FileText, RefreshCw } from 'lucide-react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { mediaApi } from '../lib/api';
import { useUIStore } from '../stores/useUIStore';
import { useMediaStore } from '../stores/useMediaStore';
import { UploadZone } from '../components/upload/UploadZone';

// ----------------------------------------------------------------------------
// 1. ARC GALLERY HERO COMPONENT (Design 1)
// ----------------------------------------------------------------------------
type ArcGalleryHeroProps = {
  images: string[];
  startAngle?: number;
  endAngle?: number;
  radiusLg?: number;
  radiusMd?: number;
  radiusSm?: number;
  cardSizeLg?: number;
  cardSizeMd?: number;
  cardSizeSm?: number;
  className?: string;
  onExploreClick?: () => void;
};

const ArcGalleryHero: React.FC<ArcGalleryHeroProps> = ({
  images,
  startAngle = 45,
  endAngle = 135,
  radiusLg = 350,
  radiusMd = 300,
  radiusSm = 250,
  cardSizeLg = 180,
  cardSizeMd = 140,
  cardSizeSm = 120,
  className = '',
  onExploreClick,
}) => {
  const [dimensions, setDimensions] = useState({
    radius: radiusLg,
    cardSize: cardSizeLg,
  });

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      if (width < 640) {
        setDimensions({ radius: radiusSm, cardSize: cardSizeSm });
      } else if (width < 1024) {
        setDimensions({ radius: radiusMd, cardSize: cardSizeMd });
      } else {
        setDimensions({ radius: radiusLg, cardSize: cardSizeLg });
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [radiusLg, radiusMd, radiusSm, cardSizeLg, cardSizeMd, cardSizeSm]);

  const count = Math.max(images.length, 2);
  const step = (endAngle - startAngle) / (count - 1);

  return (
    <section className={`relative overflow-hidden bg-[var(--bg-surface)] text-[var(--text-primary)] flex flex-col pt-12 pb-24 rounded-3xl border border-white/5 shadow-2xl ${className}`}>
      <div
        className="relative mx-auto"
        style={{
          width: '100%',
          height: dimensions.radius * 1.2,
        }}
      >
        <div className="absolute left-1/2 bottom-0 -translate-x-1/2">
          {images.map((src, i) => {
            const angle = startAngle + step * i;
            const angleRad = (angle * Math.PI) / 180;
            const x = Math.cos(angleRad) * dimensions.radius;
            const y = Math.sin(angleRad) * dimensions.radius;
            
            return (
              <div
                key={i}
                className="absolute opacity-0 animate-fade-in-up"
                style={{
                  width: dimensions.cardSize,
                  height: dimensions.cardSize,
                  left: `calc(50% + ${x}px)`,
                  bottom: `${y}px`,
                  transform: `translate(-50%, 50%)`,
                  animationDelay: `${i * 100}ms`,
                  animationFillMode: 'forwards',
                  zIndex: count - i,
                }}
              >
                <div 
                  className="rounded-2xl shadow-xl overflow-hidden ring-1 ring-white/10 bg-[var(--bg-elevated)] transition-transform hover:scale-105 w-full h-full"
                  style={{ transform: `rotate(${90 - angle}deg)` }}
                >
                  <img
                    src={src}
                    alt={`Memory ${i + 1}`}
                    className="block w-full h-full object-cover"
                    draggable={false}
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400' viewBox='0 0 400 400'%3E%3Crect width='400' height='400' fill='%231e293b'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%2364748b' font-family='sans-serif' font-size='20'%3EPhoto%3C/text%3E%3C/svg%3E`;
                      (e.target as HTMLImageElement).onerror = null; // Prevent infinite loops
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="relative z-10 flex-1 flex items-center justify-center px-6 -mt-40 md:-mt-52 lg:-mt-64">
        <div className="text-center max-w-2xl px-6 opacity-0 animate-fade-in" style={{ animationDelay: '800ms', animationFillMode: 'forwards' }}>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-display font-extrabold tracking-tight text-[var(--text-primary)]">
            A Masterpiece of Your Moments
          </h1>
          <p className="mt-4 text-lg text-[var(--text-secondary)]">
            Experience a beautifully curated gallery of your life's greatest hits, reimagined through the lens of AI.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <button 
              onClick={onExploreClick}
              className="w-full sm:w-auto px-6 py-3 rounded-full bg-[var(--accent)] text-white hover:bg-[var(--accent-dim)] transition-all duration-200 shadow-[0_0_20px_var(--accent-dim)] hover:shadow-[0_0_30px_var(--accent)] transform hover:-translate-y-0.5 font-bold"
            >
              Explore Library
            </button>
            <button className="w-full sm:w-auto px-6 py-3 rounded-full border border-white/20 hover:bg-white/10 transition-all duration-200 font-semibold text-[var(--text-primary)]">
              View Albums
            </button>
          </div>
        </div>
      </div>
      
      <style>{`
        @keyframes fade-in-up {
          from { opacity: 0; transform: translate(-50%, 60%); }
          to { opacity: 1; transform: translate(-50%, 50%); }
        }
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-up {
          animation-name: fade-in-up;
          animation-duration: 0.8s;
          animation-timing-function: ease-out;
        }
        .animate-fade-in {
          animation-name: fade-in;
          animation-duration: 0.8s;
          animation-timing-function: ease-out;
        }
      `}</style>
    </section>
  );
};

// ----------------------------------------------------------------------------
// 2. INFINITE GALLERY COMPONENT (Design 2)
// ----------------------------------------------------------------------------
type ImageItem = string | { src: string; alt?: string };

interface InfiniteGalleryProps {
	images: ImageItem[];
	speed?: number;
	visibleCount?: number;
	className?: string;
	style?: React.CSSProperties;
}

const createClothMaterial = () => {
	return new THREE.ShaderMaterial({
		transparent: true,
		uniforms: {
			map: { value: null },
			opacity: { value: 1.0 },
			blurAmount: { value: 0.0 },
			scrollForce: { value: 0.0 },
			time: { value: 0.0 },
			isHovered: { value: 0.0 },
		},
		vertexShader: `
      uniform float scrollForce;
      uniform float time;
      uniform float isHovered;
      varying vec2 vUv;
      varying vec3 vNormal;
      
      void main() {
        vUv = uv;
        vNormal = normal;
        vec3 pos = position;
        float curveIntensity = scrollForce * 0.3;
        float distanceFromCenter = length(pos.xy);
        float curve = distanceFromCenter * distanceFromCenter * curveIntensity;
        float ripple1 = sin(pos.x * 2.0 + scrollForce * 3.0) * 0.02;
        float ripple2 = sin(pos.y * 2.5 + scrollForce * 2.0) * 0.015;
        float clothEffect = (ripple1 + ripple2) * abs(curveIntensity) * 2.0;
        float flagWave = 0.0;
        if (isHovered > 0.5) {
          float wavePhase = pos.x * 3.0 + time * 8.0;
          float waveAmplitude = sin(wavePhase) * 0.1;
          float dampening = smoothstep(-0.5, 0.5, pos.x);
          flagWave = waveAmplitude * dampening;
          float secondaryWave = sin(pos.x * 5.0 + time * 12.0) * 0.03 * dampening;
          flagWave += secondaryWave;
        }
        pos.z -= (curve + clothEffect + flagWave);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      }
    `,
		fragmentShader: `
      uniform sampler2D map;
      uniform float opacity;
      uniform float blurAmount;
      uniform float scrollForce;
      varying vec2 vUv;
      varying vec3 vNormal;
      
      void main() {
        vec4 color = texture2D(map, vUv);
        if (blurAmount > 0.0) {
          vec2 texelSize = 1.0 / vec2(textureSize(map, 0));
          vec4 blurred = vec4(0.0);
          float total = 0.0;
          for (float x = -2.0; x <= 2.0; x += 1.0) {
            for (float y = -2.0; y <= 2.0; y += 1.0) {
              vec2 offset = vec2(x, y) * texelSize * blurAmount;
              float weight = 1.0 / (1.0 + length(vec2(x, y)));
              blurred += texture2D(map, vUv + offset) * weight;
              total += weight;
            }
          }
          color = blurred / total;
        }
        float curveHighlight = abs(scrollForce) * 0.05;
        color.rgb += vec3(curveHighlight * 0.1);
        gl_FragColor = vec4(color.rgb, color.a * opacity);
      }
    `,
	});
};

function ImagePlane({ texture, position, scale, material, onClick }: any) {
	const meshRef = useRef<THREE.Mesh>(null);
	const [isHovered, setIsHovered] = useState(false);

	useEffect(() => {
		if (material && texture) {
			material.uniforms.map.value = texture;
		}
	}, [material, texture]);

	useEffect(() => {
		if (material && material.uniforms) {
			material.uniforms.isHovered.value = isHovered ? 1.0 : 0.0;
		}
	}, [material, isHovered]);

	return (
		<mesh
			ref={meshRef}
			position={position}
			scale={scale}
			material={material}
			onPointerEnter={() => setIsHovered(true)}
			onPointerLeave={() => setIsHovered(false)}
			onClick={onClick}
		>
			<planeGeometry args={[1, 1, 32, 32]} />
		</mesh>
	);
}

function GalleryScene({
	images,
	speed = 1,
	visibleCount = 8,
	onImageClick
}: { images: ImageItem[], speed?: number, visibleCount?: number, onImageClick?: (index: number) => void }) {
	const fadeSettings = { fadeIn: { start: 0.05, end: 0.15 }, fadeOut: { start: 0.85, end: 0.95 } };
	const blurSettings = { blurIn: { start: 0.0, end: 0.1 }, blurOut: { start: 0.9, end: 1.0 }, maxBlur: 3.0 };
	
	const [scrollVelocity, setScrollVelocity] = useState(0);
	const [autoPlay, setAutoPlay] = useState(true);
	const lastInteraction = useRef(Date.now());

	const normalizedImages = useMemo(() => images.map((img) => typeof img === 'string' ? { src: img, alt: '' } : img), [images]);
	
  // useTexture can suspend! Ensure `<Suspense>` boundary wraps `<GalleryScene>`
	const textures = useTexture(normalizedImages.map((img) => img.src));

	const materials = useMemo(() => Array.from({ length: visibleCount }, () => createClothMaterial()), [visibleCount]);

	const spatialPositions = useMemo(() => {
		const positions: { x: number; y: number }[] = [];
		const maxHorizontalOffset = 8;
		const maxVerticalOffset = 8;
		for (let i = 0; i < visibleCount; i++) {
			const horizontalAngle = (i * 2.618) % (Math.PI * 2);
			const verticalAngle = (i * 1.618 + Math.PI / 3) % (Math.PI * 2);
			const horizontalRadius = (i % 3) * 1.2;
			const verticalRadius = ((i + 1) % 4) * 0.8;
			const x = (Math.sin(horizontalAngle) * horizontalRadius * maxHorizontalOffset) / 3;
			const y = (Math.cos(verticalAngle) * verticalRadius * maxVerticalOffset) / 4;
			positions.push({ x, y });
		}
		return positions;
	}, [visibleCount]);

	const totalImages = normalizedImages.length;
	const depthRange = 50;

	const planesData = useRef<any[]>(
		Array.from({ length: visibleCount }, (_, i) => ({
			index: i,
			z: visibleCount > 0 ? ((depthRange / visibleCount) * i) % depthRange : 0,
			imageIndex: totalImages > 0 ? i % totalImages : 0,
			x: spatialPositions[i]?.x ?? 0,
			y: spatialPositions[i]?.y ?? 0,
		}))
	);

	const handleWheel = useCallback((event: WheelEvent) => {
		event.preventDefault();
		setScrollVelocity((prev) => prev + event.deltaY * 0.01 * speed);
		setAutoPlay(false);
		lastInteraction.current = Date.now();
	}, [speed]);

	useEffect(() => {
		const canvas = document.querySelector('canvas');
		if (canvas) {
			canvas.addEventListener('wheel', handleWheel, { passive: false });
			return () => canvas.removeEventListener('wheel', handleWheel);
		}
	}, [handleWheel]);

	useEffect(() => {
		const interval = setInterval(() => {
			if (Date.now() - lastInteraction.current > 3000) setAutoPlay(true);
		}, 1000);
		return () => clearInterval(interval);
	}, []);

	useFrame((state, delta) => {
		if (autoPlay) setScrollVelocity((prev) => prev + 0.3 * delta);
		setScrollVelocity((prev) => prev * 0.95);

		const time = state.clock.getElapsedTime();
		materials.forEach((material) => {
			if (material && material.uniforms) {
				material.uniforms.time.value = time;
				material.uniforms.scrollForce.value = scrollVelocity;
			}
		});

		const imageAdvance = totalImages > 0 ? visibleCount % totalImages || totalImages : 0;
		const totalRange = depthRange;

		planesData.current.forEach((plane, i) => {
			let newZ = plane.z + scrollVelocity * delta * 10;
			let wrapsForward = 0;
			let wrapsBackward = 0;

			if (newZ >= totalRange) {
				wrapsForward = Math.floor(newZ / totalRange);
				newZ -= totalRange * wrapsForward;
			} else if (newZ < 0) {
				wrapsBackward = Math.ceil(-newZ / totalRange);
				newZ += totalRange * wrapsBackward;
			}

			if (wrapsForward > 0 && imageAdvance > 0 && totalImages > 0) {
				plane.imageIndex = (plane.imageIndex + wrapsForward * imageAdvance) % totalImages;
			}
			if (wrapsBackward > 0 && imageAdvance > 0 && totalImages > 0) {
				const step = plane.imageIndex - wrapsBackward * imageAdvance;
				plane.imageIndex = ((step % totalImages) + totalImages) % totalImages;
			}

			plane.z = ((newZ % totalRange) + totalRange) % totalRange;
			plane.x = spatialPositions[i]?.x ?? 0;
			plane.y = spatialPositions[i]?.y ?? 0;

			const normalizedPosition = plane.z / totalRange;
			let opacity = 1;

			if (normalizedPosition >= fadeSettings.fadeIn.start && normalizedPosition <= fadeSettings.fadeIn.end) {
				opacity = (normalizedPosition - fadeSettings.fadeIn.start) / (fadeSettings.fadeIn.end - fadeSettings.fadeIn.start);
			} else if (normalizedPosition < fadeSettings.fadeIn.start) {
				opacity = 0;
			} else if (normalizedPosition >= fadeSettings.fadeOut.start && normalizedPosition <= fadeSettings.fadeOut.end) {
				opacity = 1 - (normalizedPosition - fadeSettings.fadeOut.start) / (fadeSettings.fadeOut.end - fadeSettings.fadeOut.start);
			} else if (normalizedPosition > fadeSettings.fadeOut.end) {
				opacity = 0;
			}
			opacity = Math.max(0, Math.min(1, opacity));

			let blur = 0;
			if (normalizedPosition >= blurSettings.blurIn.start && normalizedPosition <= blurSettings.blurIn.end) {
				blur = blurSettings.maxBlur * (1 - (normalizedPosition - blurSettings.blurIn.start) / (blurSettings.blurIn.end - blurSettings.blurIn.start));
			} else if (normalizedPosition < blurSettings.blurIn.start) {
				blur = blurSettings.maxBlur;
			} else if (normalizedPosition >= blurSettings.blurOut.start && normalizedPosition <= blurSettings.blurOut.end) {
				blur = blurSettings.maxBlur * ((normalizedPosition - blurSettings.blurOut.start) / (blurSettings.blurOut.end - blurSettings.blurOut.start));
			} else if (normalizedPosition > blurSettings.blurOut.end) {
				blur = blurSettings.maxBlur;
			}
			blur = Math.max(0, Math.min(blurSettings.maxBlur, blur));

			const material = materials[i];
			if (material && material.uniforms) {
				material.uniforms.opacity.value = opacity;
				material.uniforms.blurAmount.value = blur;
			}
		});
	});

	if (normalizedImages.length === 0) return null;

	return (
		<>
			{planesData.current.map((plane, i) => {
				const texture = textures[plane.imageIndex];
				const material = materials[i];
				if (!texture || !material) return null;

				const worldZ = plane.z - depthRange / 2;
				const aspect = texture.image ? (texture.image as any).width / (texture.image as any).height : 1;
				const scale: [number, number, number] = aspect > 1 ? [2 * aspect, 2, 1] : [2, 2 / aspect, 1];

				return (
					<ImagePlane key={plane.index} texture={texture} position={[plane.x, plane.y, worldZ]} scale={scale} material={material} onClick={() => onImageClick?.(plane.imageIndex)} />
				);
			})}
		</>
	);
}

interface InfiniteGalleryExtendedProps extends InfiniteGalleryProps {
	onImageClick?: (index: number) => void;
}

function InfiniteGallery({ images, className = 'h-[500px] w-full', style, onImageClick }: InfiniteGalleryExtendedProps) {
	return (
		<div className={className} style={style}>
			<Canvas camera={{ position: [0, 0, 0], fov: 55 }} gl={{ antialias: true, alpha: true }}>
        <Suspense fallback={null}>
				  <GalleryScene images={images} onImageClick={onImageClick} />
        </Suspense>
			</Canvas>
		</div>
	);
}

// ----------------------------------------------------------------------------
// 3. MAIN DASHBOARD PAGE
// ----------------------------------------------------------------------------

export default function Dashboard() {
  const navigate = useNavigate();
  const { uploadModalOpen, setUploadModalOpen } = useUIStore();
  const { setMedia } = useMediaStore();
  const lastMediaSignatureRef = useRef<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const { data, status, refetch } = useInfiniteQuery({
    queryKey: ['media'],
    queryFn: ({ pageParam = 1 }) => mediaApi.getMedia(pageParam, 50),
    getNextPageParam: (lastPage) => {
      if (lastPage.pagination.page < lastPage.pagination.totalPages) {
        return lastPage.pagination.page + 1;
      }
      return undefined;
    },
    initialPageParam: 1,
  });

  const { data: stats } = useQuery({
    queryKey: ['dashboard_stats'],
    queryFn: () => mediaApi.getStats()
  });

  const allMedia = data?.pages.flatMap(page => page.data) || [];
  
  // Update media store for timeline viewing (FullView)
  useEffect(() => {
    if (allMedia.length === 0) return;
    const signature = allMedia.map((m) => m.id).join(',');
    if (!signature || signature === lastMediaSignatureRef.current) return;
    lastMediaSignatureRef.current = signature;
    setMedia(allMedia);
  }, [allMedia, setMedia]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setUploadModalOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setUploadModalOpen]);

  // Extract URLs for components
  const recentPhotoUrls = allMedia.slice(0, 20).map(m => mediaApi.getThumbnailUrl(m.id, '400'));
  const heroImageUrls = allMedia.slice(0, 6).map(m => mediaApi.getThumbnailUrl(m.id, '400'));

  // Fill empty states with placeholders to prevent empty canvas
  const displayHeroUrls = heroImageUrls.length > 0 ? heroImageUrls : [
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400' viewBox='0 0 400 400'%3E%3Crect width='400' height='400' fill='%23161922'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%2322c982' font-family='sans-serif' font-size='20'%3EMemory 1%3C/text%3E%3C/svg%3E",
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400' viewBox='0 0 400 400'%3E%3Crect width='400' height='400' fill='%23161922'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%23eceef5' font-family='sans-serif' font-size='20'%3EMemory 2%3C/text%3E%3C/svg%3E",
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400' viewBox='0 0 400 400'%3E%3Crect width='400' height='400' fill='%23161922'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%23a0a6b9' font-family='sans-serif' font-size='20'%3EMemory 3%3C/text%3E%3C/svg%3E",
  ];

  // Real stats mapped to backend response
  const totalPhotos = data?.pages[0]?.pagination.totalItems || 0;
  const peopleClusters = stats?.peopleClusters || 0; 
  const recentDocuments = stats?.recentDocuments || 0;
  
  return (
    <div className="flex-1 flex flex-col overflow-y-auto px-8 pb-12 custom-scrollbar gap-8">
      
      {/* 1. Hero Gallery */}
      <div className="mt-4">
        <ArcGalleryHero 
          images={displayHeroUrls} 
          onExploreClick={() => navigate('/explore')} 
        />
      </div>

      {/* 2. Quick Stats Row */}
      <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Link to="/media" className="bg-[var(--bg-surface)] border border-white/5 p-6 rounded-2xl shadow-lg hover:border-white/10 transition-colors flex flex-col gap-3 group">
          <div className="flex items-center justify-between">
            <h4 className="text-[var(--text-secondary)] font-medium text-sm group-hover:text-[var(--text-primary)] transition-colors">All Media</h4>
            <div className="p-2 rounded-full bg-[var(--accent)]/10 text-[var(--accent)]">
              <HardDrive size={16} />
            </div>
          </div>
          <p className="text-3xl font-display font-bold text-[var(--text-primary)]">{totalPhotos}</p>
        </Link>

        <Link to="/explore/people" className="bg-[var(--bg-surface)] border border-white/5 p-6 rounded-2xl shadow-lg hover:border-white/10 transition-colors flex flex-col gap-3 group">
          <div className="flex items-center justify-between">
            <h4 className="text-[var(--text-secondary)] font-medium text-sm group-hover:text-[var(--text-primary)] transition-colors">People Clusters</h4>
            <div className="p-2 rounded-full bg-blue-500/10 text-blue-500">
              <Users size={16} />
            </div>
          </div>
          <p className="text-3xl font-display font-bold text-[var(--text-primary)]">{peopleClusters}</p>
        </Link>

        <div className="bg-[var(--bg-surface)] border border-white/5 p-6 rounded-2xl shadow-lg hover:border-white/10 transition-colors flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h4 className="text-[var(--text-secondary)] font-medium text-sm">Recent Documents</h4>
            <div className="p-2 rounded-full bg-orange-500/10 text-orange-500">
              <FileText size={16} />
            </div>
          </div>
          <p className="text-3xl font-display font-bold text-[var(--text-primary)]">{recentDocuments}</p>
        </div>

        <div className="bg-[var(--bg-surface)] border border-white/5 p-6 rounded-2xl shadow-lg hover:border-white/10 transition-colors flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h4 className="text-[var(--text-secondary)] font-medium text-sm">Auto-Import Status</h4>
            <div className="p-2 rounded-full bg-green-500/10 text-green-500">
              <RefreshCw size={16} />
            </div>
          </div>
          <p className="text-xl font-display font-bold text-green-500 pt-1">Active</p>
          <p className="text-xs text-[var(--text-muted)]">Synced 2 mins ago</p>
        </div>
      </section>

      {/* 3. Interactive Gallery Grid */}
      <section className="mt-8 flex flex-col gap-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-2xl font-display font-bold text-[var(--text-primary)]">Interactive Gallery</h3>
            <p className="text-[var(--text-secondary)] text-sm">Scroll or drag to navigate your recent memories in 3D.</p>
          </div>
        </div>

        <div className="relative w-full h-[600px] bg-gradient-to-b from-[var(--bg-surface)] to-[var(--bg-primary)] rounded-3xl overflow-hidden border border-white/5 shadow-2xl">
          {status === 'pending' ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-[var(--text-secondary)]">
              <Loader2 className="animate-spin text-[var(--accent)]" size={32} />
              <p>Loading your spatial gallery...</p>
            </div>
          ) : status === 'error' ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-[var(--text-secondary)]">
              <p className="text-[var(--danger)]">Failed to load media.</p>
              <button onClick={() => refetch()} className="px-4 py-2 border border-white/10 rounded-full hover:bg-white/5 transition-colors">Retry</button>
            </div>
          ) : recentPhotoUrls.length > 0 ? (
            <InfiniteGallery images={recentPhotoUrls} onImageClick={(idx) => setSelectedImage(mediaApi.getOriginalUrl(allMedia[idx].id))} />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-[var(--text-secondary)]">
              <ImageIcon size={48} className="opacity-50" />
              <p>No photos yet. Start uploading to see them here.</p>
            </div>
          )}
        </div>
      </section>

      {/* Upload Modal */}
      {uploadModalOpen && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-8 bg-black/60 backdrop-blur-xl animate-in fade-in duration-300">
          <div className="absolute inset-0" onClick={() => setUploadModalOpen(false)} />
          <div className="relative w-full max-w-2xl bg-[var(--bg-surface)] border border-white/10 rounded-[32px] p-2 shadow-2xl animate-in slide-in-from-bottom-8 duration-500">
            <div className="p-8">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-display font-bold text-[var(--text-primary)]">Upload Media</h2>
                <button onClick={() => setUploadModalOpen(false)} className="p-2 rounded-full hover:bg-white/5 text-[var(--text-secondary)] hover:text-white transition-colors">
                  <X size={24} />
                </button>
              </div>
              <UploadZone />
            </div>
          </div>
        </div>
      )}

      {/* Lightbox Modal */}
      <AnimatePresence>
        {selectedImage && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[600] flex items-center justify-center bg-black/80 backdrop-blur-xl p-8 cursor-pointer"
            onClick={() => setSelectedImage(null)}
          >
            <button 
              onClick={() => setSelectedImage(null)} 
              className="absolute top-6 right-6 p-3 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors z-[610]"
            >
              <X size={28} />
            </button>
            <motion.img 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              src={selectedImage} 
              alt="Expanded Memory" 
              className="w-full h-full object-contain mx-auto rounded-2xl shadow-2xl ring-1 ring-white/10 cursor-default"
              onClick={(e) => e.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
