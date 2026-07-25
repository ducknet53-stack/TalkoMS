export async function uploadImage(file: File): Promise<string | null> {
  const apiKey = 
    (import.meta.env && import.meta.env.VITE_IMGBB_API_KEY) || 
    (typeof process !== 'undefined' && process.env && process.env.VITE_IMGBB_API_KEY) || 
    '';

  if (!apiKey) {
    console.error("VITE_IMGBB_API_KEY is not set in environment variables.");
    throw new Error("Lütfen ayarlardan ImgBB API anahtarınızı (VITE_IMGBB_API_KEY) ekleyin.");
  }

  const formData = new FormData();
  formData.append('image', file);

  try {
    const response = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
      method: 'POST',
      body: formData,
    });

    const data = await response.json();
    if (data.success) {
      return data.data.url;
    } else {
      throw new Error(data.error?.message || "Image upload failed");
    }
  } catch (error) {
    console.error("Error uploading image:", error);
    throw error;
  }
}
