export function handleGenericError(e, next) {
    console.error(e);
    err.status = 500;
    return next(err);
}
