export async function assertThrows(f) {
  // TODO: There must be a better pattern for doing this with chai
  let failed = false;
  try {
    await f();
  } catch (e) {
    failed = true;
  }
  assert.isTrue(failed);
}
