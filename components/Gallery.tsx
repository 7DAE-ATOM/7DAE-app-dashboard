"use client";

import { useMemo, useState } from "react";
import type { Photo, LinkedResourceRef } from "@/lib/types";
import { usePhoto } from "@/lib/usePhoto";
import {
  COLOR_PAIRS,
  generateApplicationCoverDataUri,
  hashSeed,
} from "@/lib/generated-cover";
import DocKindIcon from "./icons/DocKindIcon";
import VideoIcon from "./icons/VideoIcon";
import PanoramaClient from "./PanoramaClient";

function SimulatedThumbnail({
  src,
  active,
  onClick,
}: {
  src: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative aspect-square rounded overflow-hidden border-2 transition-all ${
        active
          ? "border-accent opacity-100"
          : "border-transparent opacity-60 hover:opacity-100"
      }`}
      type="button"
    >
      <img src={src} alt="" className="w-full h-full object-cover" />
    </button>
  );
}

function PhotoSlide({ photo }: { photo: Photo }) {
  const { url, isLoading } = usePhoto(
    photo.resourceId,
    photo.resourceUri,
    !photo.is360,
  );
  if (photo.is360) return <PanoramaClient src={url} />;
  return (
    <>
      <img src={url} alt={photo.alt ?? ""} className="w-full h-full object-cover" />
      {isLoading && (
        <div className="absolute inset-0 skeleton-pulse bg-surface-2" />
      )}
    </>
  );
}

function Thumbnail({
  photo,
  active,
  onClick,
}: {
  photo: Photo;
  active: boolean;
  onClick: () => void;
}) {
  const { url, isLoading } = usePhoto(
    photo.resourceId,
    photo.resourceUri,
    !photo.is360,
  );
  return (
    <button
      onClick={onClick}
      title={photo.is360 ? "Image 360°" : undefined}
      className={`relative aspect-square rounded overflow-hidden border-2 transition-all ${
        active
          ? "border-accent opacity-100"
          : "border-transparent opacity-60 hover:opacity-100"
      }`}
      type="button"
    >
      <img src={url} alt={photo.alt ?? ""} className="w-full h-full object-cover" />
      {isLoading && <div className="absolute inset-0 skeleton-pulse bg-surface-2" />}
      {photo.is360 && (
        <span
          aria-hidden="true"
          className="absolute top-1 right-1 px-1 py-0.5 rounded text-[10px] font-mono bg-accent text-accent-fg leading-none"
        >
          360°
        </span>
      )}
    </button>
  );
}

function ResourceThumbnail({
  resource,
  active,
  onClick,
}: {
  resource: LinkedResourceRef;
  active: boolean;
  onClick: () => void;
}) {
  const [primary, secondary] =
    COLOR_PAIRS[hashSeed(resource.id) % COLOR_PAIRS.length];
  return (
    <button
      onClick={onClick}
      title={resource.name}
      className={`relative aspect-square rounded overflow-hidden border-2 transition-all ${
        active
          ? "border-accent opacity-100"
          : "border-transparent opacity-60 hover:opacity-100"
      }`}
      type="button"
    >
      <div
        className="w-full h-full flex flex-col items-center justify-center gap-1 px-1"
        style={{ background: `linear-gradient(135deg, ${primary}, ${secondary})` }}
      >
        {resource.kind === "video" ? (
          <VideoIcon size={20} className="text-white" />
        ) : (
          <DocKindIcon kind={resource.kind} size={20} className="text-white" />
        )}
        <span className="text-[9px] leading-tight text-center truncate w-full text-white/90 font-medium">
          {resource.name}
        </span>
      </div>
    </button>
  );
}

export type GalleryEmbedOverride = {
  name: string;
  /** Canonical embed URL, or null if extraction failed (fallback link). */
  embedUrl: string | null;
  /** Raw documentRef.url, used for the "Open" fallback link. */
  rawUrl: string;
} | null;

export default function Gallery({
  photos,
  name,
  externalId,
  resources = [],
  activeResourceId = null,
  onSelectResource,
  resourceOverride = null,
  onPhotoSelect,
}: {
  photos: Photo[];
  name: string;
  externalId: string;
  resources?: LinkedResourceRef[];
  activeResourceId?: string | null;
  onSelectResource?: (resource: LinkedResourceRef) => void;
  resourceOverride?: GalleryEmbedOverride;
  onPhotoSelect?: () => void;
}) {
  // The generated cover is the default main image unless a real photo is
  // explicitly flagged "SELECTED" by the backend naming convention — real
  // photos without that flag still show up as extra thumbnails, but never
  // become the hero on their own.
  const hasSelectedPhoto = photos.some((p) => p.kind === "selected");
  const [activePhotoIndex, setActivePhotoIndex] = useState(() =>
    photos.findIndex((p) => p.kind === "selected"),
  );
  const current = activePhotoIndex >= 0 ? photos[activePhotoIndex] : undefined;
  const isSimulated = !current;

  const simulatedPhotos = useMemo(
    () => [generateApplicationCoverDataUri(name, externalId)],
    [name, externalId],
  );

  const selectPhoto = (i: number) => {
    setActivePhotoIndex(i);
    onPhotoSelect?.();
  };

  const selectGeneratedCover = () => {
    setActivePhotoIndex(-1);
    onPhotoSelect?.();
  };

  const resourceThumbnails = resources.map((resource) => (
    <ResourceThumbnail
      key={resource.id}
      resource={resource}
      active={activeResourceId === resource.id}
      onClick={() => onSelectResource?.(resource)}
    />
  ));

  const showGeneratedCoverThumbnail = !hasSelectedPhoto;
  const showRealPhotoThumbnails =
    photos.length > 1 || (photos.length === 1 && showGeneratedCoverThumbnail);
  const showThumbnailStrip =
    showGeneratedCoverThumbnail || showRealPhotoThumbnails || resources.length > 0;

  const thumbnailStrip = showThumbnailStrip ? (
    <div className="grid grid-cols-5 sm:grid-cols-8 gap-2">
      {showGeneratedCoverThumbnail &&
        simulatedPhotos.map((src) => (
          <SimulatedThumbnail
            key={src}
            src={src}
            active={isSimulated}
            onClick={selectGeneratedCover}
          />
        ))}
      {showRealPhotoThumbnails &&
        photos.map((p, i) => (
          <Thumbnail
            key={i}
            photo={p}
            active={i === activePhotoIndex}
            onClick={() => selectPhoto(i)}
          />
        ))}
      {resourceThumbnails}
    </div>
  ) : null;

  let heroContent: React.ReactNode;
  if (resourceOverride) {
    heroContent = resourceOverride.embedUrl ? (
      <iframe
        src={resourceOverride.embedUrl}
        className="w-full h-full"
        allow="autoplay"
        title={resourceOverride.name}
      />
    ) : (
      <div className="w-full h-full flex items-center justify-center p-4 text-center">
        <a
          href={resourceOverride.rawUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent hover:underline break-all"
        >
          Ouvrir
        </a>
      </div>
    );
  } else if (isSimulated) {
    const simulatedSrc = simulatedPhotos[0];
    heroContent = (
      <>
        <img src={simulatedSrc} alt="" className="w-full h-full object-cover" />
        <span className="absolute top-2 right-2 px-2 py-0.5 rounded text-[10px] font-mono text-muted bg-surface/90 backdrop-blur-md">
          Preview
        </span>
      </>
    );
  } else {
    heroContent = <PhotoSlide photo={current} />;
  }

  return (
    <div className="space-y-3">
      <div className="relative aspect-video bg-surface-2 rounded-card overflow-hidden">
        {heroContent}
      </div>
      {thumbnailStrip}
    </div>
  );
}
