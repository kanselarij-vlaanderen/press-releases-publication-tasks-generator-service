import { sparqlEscapeString, sparqlEscapeUri, sparqlEscapeDateTime, uuid } from 'mu';
import { querySudo as query } from '@lblod/mu-auth-sudo';
import { isNotNullOrUndefined, isNullOrUndefined } from './util';

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
				${sparqlEscapeUri(pressRelease)}		ebucore:isScheduledOn 				?publicationEvent .
				?publicationEvent						ebucore:publishedStartDateTime 		?publishedStartDateTime .
			}
		}
	`);
}

export function setPublicationStartDateTimeAndPublishedStartDateTime(graph, pressRelease, dateTime, publicationEvent = null) {

	// if press release is undefined and publicationEvent is defined, it will update by publication event
	// if press release is defined and publicationEvent is undefined, it will update by press release

	const byPressRelease = isNotNullOrUndefined(pressRelease);

	const where = byPressRelease ? `WHERE {
			GRAPH ${sparqlEscapeUri(graph)} {
				${sparqlEscapeUri(pressRelease)}	ebucore:isScheduledOn 				?publicationEvent .
			}
		}` : '';

	return query(`
		${PREFIXES}
		
		INSERT {
			GRAPH ${sparqlEscapeUri(graph)} {
				${byPressRelease ? '?publicationEvent' : publicationEvent}	ebucore:publicationStartDateTime 	${sparqlEscapeDateTime(dateTime)} ;
									ebucore:publishedStartDateTime 		${sparqlEscapeDateTime(dateTime)} .
			}
		} 
		${where}
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
						    	dct:modified						${sparqlEscapeDateTime(now)};
						    	ext:publicationChannel			${sparqlEscapeUri(publicationChannel)};
						    	mu:uuid 						${sparqlEscapeString(newId)}  .
						    	
			${sparqlEscapeUri(publicationEvent)} 	prov:generated		vlpt:${newId} .
			}
		} 

	`);
}

export async function createPublicationTasksPerPublicationChannel(graph, pressRelease, publicationEvent) {
	let publicationChannels;

	try {
		if (isNotNullOrUndefined(pressRelease)) {
			// get publicaton-channels linked to the press-release
			publicationChannels = (await getPublicationChannelsByPressRelease(graph, pressRelease)).results.bindings;
		} else {
			// get publicaton-channels linked to the publication-event
			publicationChannels = (await getPublicationChannelsByPublicationEvent(graph, publicationEvent)).results.bindings;
		}

		// create  a publicationTask for every channel linked to the press-release
		for (let publicationChannel of publicationChannels) {
			await createPublicationTask(graph, publicationChannel.pubChannel.value, publicationEvent);
		}

		return;

	} catch (err) {
		throw err;
	}
}

export function getPublicationChannelsByPublicationEvent(graph, publicationEvent) {
	return query(`
		${PREFIXES}
		
		SELECT ?pubChannel
		WHERE {
			GRAPH ${sparqlEscapeUri(graph)} {
				${sparqlEscapeUri(publicationEvent)}	ext:publicationChannels 	?pubChannel .
			}
		}
	`);

}

export async function getPlannedPublicationEvents() {
	const now = new Date();
	const queryResult = await query(`
			${PREFIXES}
			
			SELECT ?graph ?publicationEvent
			 WHERE {
				GRAPH ?graph {
					{
						?publicationEvent		a		ebucore:PublicationEvent .
						FILTER NOT EXISTS { ?publicationEvent 	ebucore:publicationStartDateTime 	?publicationStartDateTime }
					}
					UNION	
					{
						?publicationEvent		a									ebucore:PublicationEvent ;
												ebucore:publishedStartDateTime 		?publishedStartDateTime .
						FILTER ( ?publishedStartDateTime <= ${sparqlEscapeDateTime(now)} )  
					}
				}
			 }	
	`);

	if (!queryResult.results || !queryResult.results.bindings) {
		return [];
	}

	return queryResult.results.bindings.map((binding) => {
		return {
			graph: binding.graph.value,
			publicationEvent: binding.publicationEvent.value,
		};
	});

}
