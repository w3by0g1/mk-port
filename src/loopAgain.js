// Starts a video again from the top when it comes to its end. The videos
// are told to loop as well, but a recording saved without its own length
// can stop at the end all the same, and this sets it going again either
// way.
export const loopAgain = (e) => {
  const video = e.currentTarget;
  video.currentTime = 0;
  video.play().catch(() => {});
};
