export const COMPLIANCE_FILE_ACCEPT = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
].join(",");

export const COMPLIANCE_FILE_MAX_BYTES = 8 * 1024 * 1024;

const supportedComplianceFileTypes = new Set(COMPLIANCE_FILE_ACCEPT.split(","));

export function validateComplianceFile(file: File) {
  if (!supportedComplianceFileTypes.has(file.type)) {
    return "Upload a PDF, Word, text, JPG, PNG, or WebP file.";
  }

  if (file.size > COMPLIANCE_FILE_MAX_BYTES) {
    return "Compliance files must be 8MB or smaller.";
  }

  return null;
}

export function readComplianceFileDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }
      reject(new Error("Unable to read compliance file."));
    };
    reader.onerror = () => reject(new Error("Unable to read compliance file."));
    reader.readAsDataURL(file);
  });
}

export function downloadDataUrl(dataUrl: string, fileName: string) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
}
