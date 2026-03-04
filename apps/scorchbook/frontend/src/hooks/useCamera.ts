import { useEffect, useRef, useState } from "react";

const waitForVideoReady = (video: HTMLVideoElement) =>
  new Promise<void>((resolve) => {
    if (video.readyState >= 2 && video.videoWidth > 0) {
      resolve();
      return;
    }
    const handleReady = () => resolve();
    video.addEventListener("loadedmetadata", handleReady, { once: true });
    video.addEventListener("canplay", handleReady, { once: true });
  });

const getVideoDimensions = (video: HTMLVideoElement, stream: MediaStream | null) => {
  let width = video.videoWidth;
  let height = video.videoHeight;
  if ((!width || !height) && stream) {
    const settings = stream.getVideoTracks()[0]?.getSettings?.();
    width = settings?.width ?? width;
    height = settings?.height ?? height;
  }
  return { width: width || 640, height: height || 480 };
};

export function useCamera(onError: (msg: string) => void) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [active, setActive] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [preview, setPreview] = useState("");
  const [base64, setBase64] = useState("");
  const [mimeType, setMimeType] = useState("");

  // Attach stream to video element
  useEffect(() => {
    const video = videoRef.current;
    if (!stream || !active || !video) return;
    video.srcObject = stream;
    video.play().catch(() => {
      onError("Unable to start camera preview.");
    });
    return () => {
      if (video.srcObject === stream) {
        video.srcObject = null;
      }
    };
  }, [stream, active, onError]);

  // Cleanup stream on unmount
  useEffect(() => {
    return () => {
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [stream]);

  const start = () => {
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" } })
      .then((mediaStream) => {
        setStream(mediaStream);
        setActive(true);
      })
      .catch(() => {
        onError("Camera access denied or unavailable.");
      });
  };

  const stop = () => {
    stream?.getTracks().forEach((track) => track.stop());
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setStream(null);
    setActive(false);
  };

  const capture = () => {
    if (!videoRef.current) {
      onError("Camera preview is not ready.");
      return;
    }
    const video = videoRef.current;
    waitForVideoReady(video)
      .then(() => {
        const canvas = document.createElement("canvas");
        const { width, height } = getVideoDimensions(video, stream);
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d");
        if (!context) return;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
        const base64Payload = dataUrl.split(",")[1] ?? "";
        if (base64Payload.length < 100) {
          onError("Unable to capture photo. Try again.");
          return;
        }
        setPreview(dataUrl);
        setBase64(dataUrl);
        setMimeType("image/jpeg");
        stop();
      })
      .catch(() => {
        onError("Unable to capture photo. Try again.");
      });
  };

  const clear = () => {
    setPreview("");
    setBase64("");
    setMimeType("");
  };

  const setExistingPreview = (url: string) => {
    setPreview(url);
  };

  return [videoRef, { active, preview, base64, mimeType, start, stop, capture, clear, setExistingPreview }] as const;
}
