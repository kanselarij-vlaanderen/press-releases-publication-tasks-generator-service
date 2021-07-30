import {app} from 'mu';
import {querySudo as query, updateSudo as update} from '@lblod/mu-auth-sudo';
import {findPressReleasesWithPublicationEvents, removeFuturePublicationDate} from './helpers/press-release-sparql-queries'
import {isNotNullOrUndefined} from "./helpers/util";

app.post('/press-releases/:uuid/publish', async (req, res) => {

	// Retrieve press release uuid from request
	const pressReleaseUUID = req.params.uuid;

	// Op basis van de uuid uit de request wordt het persbericht (fabio:PressRelease)
	// en bijhorend publication event (ebucore:PublicationEvent) opgezocht in de triplestore.
	let queryResult;
	let pressRelease;
	let plannedStartDate;
	let started;
	let graph;

	try {
		queryResult = await query(findPressReleasesWithPublicationEvents(pressReleaseUUID));
	} catch (err) {
		console.error(err);
		res.sendStatus(500);
		return;
	}


	// Indien dit niet gevonden kan worden, geeft het endpoint status 404 Not Found terug.
	if (!queryResult.results.bindings.length) {
		res.sendStatus(404);
		return;
	} else {
		pressRelease = queryResult.results.bindings[0].pressRelease.value;
		graph = queryResult.results.bindings[0].graph.value;
		plannedStartDate = queryResult.results.bindings[0].publicationStartDateTime ? queryResult.results.bindings[0].publicationStartDateTime.value: undefined;
		started = queryResult.results.bindings[0].started ? queryResult.results.bindings[0].started.value : undefined;

	}

	// Indien het publication event reeds een ebucore:publicationStartDateTime heeft, wordt status 409 Conflict teruggegeven.
	// Het persbericht is in dat geval al eerder gepubliceerd en kan niet opnieuw gepubliceerd worden.

	if (isNotNullOrUndefined(started)) {
		res.status(409).send('Press-release already published.');
		return;
	}

	// indien het persbericht gepland is om gepubliceerd te worden in de toekomst
	// (dwz ebucore:publishedStartDateTime bevat een datum in de toekomst),
	// wordt deze datum verwijderd uit de triplestore. De publicatie-request overruled deze geplande datum

	if (isNotNullOrUndefined(plannedStartDate) && new Date(plannedStartDate) > new Date()) {
		try {
			const result = await query(removeFuturePublicationDate(graph, pressReleaseUUID));
			console.log(result);
		} catch (e) {
			console.error(e);
			res.sendStatus(500);
		}
	}

	// Vervolgens wordt ebucore:publicationStartDateTime en ebucore:publishedStartDateTime ingesteld op de
	// huidige tijd om aan te geven dat het persbericht nu gepubliceerd wordt.

	try {
		await query(setPublicationStartDateTimeAndPublishedStartDateTime(graph, pressReleaseUUID, new Date()));
	} catch (e) {
		console.error(e);
		res.sendStatus(500);
	}

	// Voor ieder publicatiekanaal ebucore:PublicationChannel dat gelinkt is aan het publication event, wordt een
	// publication-task resource geinsert in de triplestore. Deze publication-task zal later opgepikt
	// worden door andere microservice(s).

	// TODO:

	res.sendStatus(200);

});
