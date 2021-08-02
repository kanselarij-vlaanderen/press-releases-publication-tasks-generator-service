import { sparqlEscapeString, sparqlEscapeUri, sparqlEscapeDateTime, uuid } from 'mu';
import { querySudo as query } from '@lblod/mu-auth-sudo';

const PREFIXES = `
		PREFIX mu: ${sparqlEscapeUri('http://mu.semte.ch/vocabularies/core/')}
		PREFIX ebucore: ${sparqlEscapeUri('http://www.ebu.ch/metadata/ontologies/ebucore/ebucore#')}
		PREFIX ext: ${sparqlEscapeUri('http://mu.semte.ch/vocabularies/ext/')}
		PREFIX vlpt: ${sparqlEscapeUri('http://themis.vlaanderen.be/id/publicatie-taak/')}
		PREFIX adms: ${sparqlEscapeUri('http://www.w3.org/ns/adms#')}
		PREFIX dct: ${sparqlEscapeUri('http://purl.org/dc/terms/')}
		PREFIX prov: ${sparqlEscapeUri('http://www.w3.org/ns/prov#')}
		`;

export async function findPressReleasesWithPublicationEvents(id) {

	try {
		const queryResult = await query(`
			 ${PREFIXES}
			 
			 SELECT ?graph ?pressRelease ?publicationEvent ?publicationStartDateTime ?started ?publicationChannels
			 WHERE {
				GRAPH ?graph {
					?pressRelease 					mu:uuid 									${sparqlEscapeString(id)} ;
									       			ebucore:isScheduledOn 						?publicationEvent .
					OPTIONAL { ?publicationEvent 	ebucore:publicationStartDateTime			?started }
					OPTIONAL { ?publicationEvent 	ebucore:publishedStartDateTime	 			?publicationStartDateTime }
					OPTIONAL { ?publicationEvent 	ebucore:hasChannelPublicationEvent 			?publicationChannels }
				}
			 }
			 LIMIT 1
			 `);

		if (!queryResult.results.bindings.length) {
			return null;
		} else {
			const bindings = queryResult.results.bindings[0];

			return {
				bindings,
				pressRelease: bindings.pressRelease.value,
				graph: bindings.graph.value,
				publicationEvent: bindings.publicationEvent.value,
				plannedStartDate: bindings.publicationStartDateTime ? bindings.publicationStartDateTime.value : undefined,
				started: bindings.started ? bindings.started.value : undefined,
			};
		}
	} catch (err) {
		throw err;
	}

}

export function removeFuturePublicationDate(graph, pressRelease) {
	return query(`
		${PREFIXES}
		
		DELETE {
			GRAPH ${sparqlEscapeUri(graph)} {
				?publicationEvent	ebucore:publishedStartDateTime	?publishedStartDateTime .
			}
		} WHERE {
			GRAPH ${sparqlEscapeUri(graph)} {
				${sparqlEscapeUri(pressRelease)}		ebucore:isScheduledOn 			?publicationEvent .
				?publicationEvent						ebucore:publishedStartDateTime 	?publishedStartDateTime .
			}
		}
	`);
}

export function setPublicationStartDateTimeAndPublishedStartDateTime(graph, pressRelease, dateTime) {
	return query(`
		${PREFIXES}
		
		INSERT {
			GRAPH ${sparqlEscapeUri(graph)} {
				?publicationEvent	ebucore:publicationStartDateTime 	${sparqlEscapeDateTime(dateTime)} ;
									ebucore:publishedStartDateTime 		${sparqlEscapeDateTime(dateTime)} .
			}
		} WHERE {
			GRAPH ${sparqlEscapeUri(graph)} {
				${sparqlEscapeUri(pressRelease)}	ebucore:isScheduledOn 				?publicationEvent .
			}
		}
	`);
}

export function getPublicationChannelsByPressRelease(graph, pressRelease) {
	return query(`
		${PREFIXES}
		
		SELECT ?pressRelease ?pubChannel
		WHERE {
			GRAPH ${sparqlEscapeUri(graph)} {
				${sparqlEscapeUri(pressRelease)}		ext:publicationChannels 	?pubChannel .
			}
		}
	`);

}

export function createPublicationTask(graph, publicationChannel, publicationEvent) {
	const newId = uuid();
	const notStartedURI = 'http://themis.vlaanderen.be/id/concept/publication-task-status/not-started';
	const now = new Date();

	return query(`
		${PREFIXES}
		INSERT DATA {
			GRAPH ${sparqlEscapeUri(graph)} {
		
			vlpt:${newId} 		a 								ext:PublicationTask ;
								adms:status 					${sparqlEscapeUri(notStartedURI)} ;
						    	dct:created						${sparqlEscapeDateTime(now)};
						    	dct:modified					${sparqlEscapeDateTime(now)};
						    	ext:publicationChannel			${sparqlEscapeUri(publicationChannel)};
						    	prov:generated					${sparqlEscapeUri(publicationEvent)};
						    	mu:uuid 						${sparqlEscapeString(newId)}  .
			}
		} 

	`);
}

export async function createPublicationTasksPerPublicationChannel(graph, pressRelease, publicationEvent) {

	try {
		// get publicaton-channels linked to the press-release
		const publicationChannels = (await getPublicationChannelsByPressRelease(graph, pressRelease)).results.bindings;

		// create  a publicationTask for every channel linked to the press-release
		for (let publicationChannel of publicationChannels) {
			await createPublicationTask(graph, publicationChannel.pubChannel.value, publicationEvent);
		}

		return;

	} catch (err) {
		throw err;
	}
}
