import {sparqlEscapeString, sparqlEscapeUri} from 'mu';

const PREFIXES = `
		PREFIX mu: ${sparqlEscapeUri('http://mu.semte.ch/vocabularies/core/')}
		PREFIX ebucore: ${sparqlEscapeUri('http://www.ebu.ch/metadata/ontologies/ebucore/ebucore#')}
		`

export function findPressReleasesWithPublicationEvents(id) {
	return `
			 ${PREFIXES}
			 
			 SELECT ?graph ?pressRelease ?publicationEvent ?publicationStartDateTime ?publicationChannel ?started
			 WHERE {
				GRAPH ?graph {
					?pressRelease 					mu:uuid 									${sparqlEscapeString(id)} ;
									       			ebucore:isScheduledOn 						?publicationEvent .
					OPTIONAL { ?publicationEvent 	ebucore:publicationStartDateTime			?started }
					OPTIONAL { ?publicationEvent 	ebucore:publishedStartDateTime	 			?publicationStartDateTime }
					OPTIONAL { ?publicationEvent 	ebucore:hasChannelPublicationEvent 			?publicationChannel }
				}
			 }
			 LIMIT 1
			 `;
}

export function removeFuturePublicationDate(graph, pressReleaseId) {
	return `
		${PREFIXES}
		
		DELETE {
			GRAPH ${sparqlEscapeUri(graph)} {
				?publicationEvent	ebucore:publishedStartDateTime	?publishedStartDateTime .
			}
		} WHERE {
			GRAPH ${sparqlEscapeUri(graph)} {
				?pressRelease 		mu:uuid 						${sparqlEscapeString(pressReleaseId)};
							  		ebucore:isScheduledOn 			?publicationEvent .
				?publicationEvent	ebucore:publishedStartDateTime 	?publishedStartDateTime .
			}
		}
	`;
}

export function setPublicationStartDateTimeAndPublishedStartDateTime(graph, pressReleaseId, dateTime) {
	return `
	
	`;
}

