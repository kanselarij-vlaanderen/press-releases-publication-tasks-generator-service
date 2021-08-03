import { app, errorHandler } from 'mu';
import {
	findPressReleasesWithPublicationEvents,
	removeFuturePublicationDate,
	createPublicationTask,
	getPublicationChannelsByPressReleaseUUID,
	setPublicationStartDateTimeAndPublishedStartDateTime,
	createPublicationTasksPerPublicationChannel,
	getPlannedPublicationEvents
} from './helpers/press-release-sparql-queries';
import { isNotNullOrUndefined, isNullOrUndefined, handleGenericError } from './helpers/util';

app.post('/press-releases/:uuid/publish', async (req, res, next) => {

	// Retrieve press release uuid from request
	const pressReleaseUUID = req.params.uuid;

	// Based on the request uuid the corresponding press-release (fabio:PressRelease) and 
	// publication-event (ebucore:PublicationEvent) are retrieved from the triplestore.
	const currentDate = new Date();
	let queryResult;

	try {
		queryResult = await findPressReleasesWithPublicationEvents(pressReleaseUUID);
	} catch (err) {
		return handleGenericError(err, next);
	}


	// If these cannot be found, the api will respond wit 404 (not found).
	if (isNullOrUndefined(queryResult)) {
		res.sendStatus(404);
		return;
	}


	// if the pulblication event already has a ebucore:publicationStartDateTime, the api will respond with status 409 (Conflict).
	// in that case, the press-release has already been published and cannot be re-published.
	if (isNotNullOrUndefined(queryResult.started)) {
		res.status(409).send('Press-release already published.');
		return;
	}


	// in case the press-release has been planned to be published in the future,
	// (ebucore:publishedStartDateTime contains a date in the future),
	// this date will be removed from the triplestore since a publication-request overrules a planned publication.
	if (isNotNullOrUndefined(queryResult.plannedStartDate) && new Date(queryResult.plannedStartDate) > new Date()) {
		try {
			await removeFuturePublicationDate(queryResult.graph, queryResult.pressRelease);
		} catch (err) {
			return handleGenericError(err, next);
		}
	}


	try {
		// next the ebucore:publicationStartDateTime and ebucore:publishedStartDateTime will be set to the current time to
		// to indicate that the press-release is being published now.
		await setPublicationStartDateTimeAndPublishedStartDateTime(queryResult.graph, queryResult.pressRelease, currentDate);


		// for every publication-channel (ebucore:PublicationChannel) related to the  publication-event,
		// a publicaton-task resource will be inserted to the triplestore.
		// this publication-task will be picked up by the other micro-service(s).
		await createPublicationTasksPerPublicationChannel(queryResult.graph, queryResult.pressRelease, queryResult.publicationEvent);

	} catch (err) {
		return handleGenericError(err, next);
	}

	// if all went well, we respond with 200 (success)
	res.sendStatus(200);
	return;

});


app.post('/delta', async (req, res, next) => {

	try {
		// when a new notification arrives at /delta a query is executed at the triplestore that
		// selects all publication-events with:
		// - a ebucore:publishedStartDateTime in the past
		// - no ebucore:publicationStartDateTime
		const publicationEventsQueryResults = await getPlannedPublicationEvents();

		for (const pubEvent of publicationEventsQueryResults) {
			// Create a publication task for every publicationEvent the query returns
			await createPublicationTasksPerPublicationChannel(pubEvent.graph, null, pubEvent.publicationEvent);

			// update every publicationEvent so that we know it has started
			// TODO:
		}

	} catch (err) {
		return handleGenericError(err, next);
	}

	// if all went well, we respond with 200 (success)
	res.sendStatus(200);
	return;

});

// use mu errorHandler middleware.
app.use(errorHandler);
