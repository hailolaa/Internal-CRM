export const CAMPAIGN_MEDIA_ACCEPT = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
].join(",");

export const CAMPAIGN_MEDIA_MAX_BYTES = 5 * 1024 * 1024;
export const CAMPAIGN_MEDIA_MAX_ITEMS = 6;

const supportedMediaTypes = new Set(CAMPAIGN_MEDIA_ACCEPT.split(","));

export function validateCampaignMediaFile(file: File) {
  if (!supportedMediaTypes.has(file.type)) {
    return "Upload a JPG, PNG, WebP, GIF, or MP4 file.";
  }

  if (file.size > CAMPAIGN_MEDIA_MAX_BYTES) {
    return "Campaign media files must be 5MB or smaller.";
  }

  return null;
}

export function readCampaignMediaDataUrl(
  file: File,
  onProgress?: (progress: number) => void,
) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onprogress = (event) => {
      if (!event.lengthComputable) return;
      onProgress?.(Math.round((event.loaded / event.total) * 100));
    };
    reader.onload = () => {
      if (typeof reader.result === "string") {
        onProgress?.(100);
        resolve(reader.result);
        return;
      }
      reject(new Error("Unable to read campaign media file."));
    };
    reader.onerror = () => reject(new Error("Unable to read campaign media file."));
    reader.readAsDataURL(file);
  });
}
