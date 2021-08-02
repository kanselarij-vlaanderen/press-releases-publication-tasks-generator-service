export function isNotNullOrUndefined(e) {
	return e != null;
}

export function isNullOrUndefined(e) {
	return e == null;
}

export function handleGenericError(e, next) {
	console.error(e);
	err.status = 500;
	return next(err);
}
