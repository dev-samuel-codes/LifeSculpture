export async function replacePendingImages({
  content,
  pendingImages,
  uploadImage,
  category,
  postId,
  onUploaded,
}) {
  if (!Array.isArray(pendingImages) || pendingImages.length === 0) {
    return content;
  }

  let updatedContent = content;
  for (const { file, tempUrl } of pendingImages) {
    const url = await uploadImage(file, { category, postId });
    if (!url) {
      throw new Error('이미지 업로드에 실패했습니다.');
    }
    onUploaded?.(url);
    updatedContent = updatedContent.replace(tempUrl, url);
  }

  return updatedContent;
}
