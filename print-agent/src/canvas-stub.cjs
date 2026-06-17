// Stub for the optional `canvas` dependency of esc-pos-encoder.
// We don't render images, so we just provide a no-op surface.
module.exports = {
  createCanvas() {
    throw new Error("canvas not bundled in SAINTS Print-Agent");
  },
  Image: class {},
  loadImage() {
    throw new Error("canvas not bundled in SAINTS Print-Agent");
  },
};
