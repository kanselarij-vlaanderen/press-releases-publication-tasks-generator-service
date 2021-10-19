export function handleGenericError(e, next) {
  console.info(e);
  err.status = 500;
  return next(err);
}
