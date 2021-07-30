import {sparqlEscapeString, sparqlEscapeUri, sparqlEscapeDateTime, uuid} from 'mu';

const PREFIXES = `
		PREFIX mu: ${sparqlEscapeUri('http://mu.semte.ch/vocabularies/core/')}
		PREFIX ebucore: ${sparqlEscapeUri('http://www.ebu.ch/metadata/ontologies/ebucore/ebucore#')}
		PREFIX ext: ${sparqlEscapeUri('http://mu.semte.ch/vocabularies/ext/')}
		PREFIX vlpt: ${sparqlEscapeUri('http://themis.vlaanderen.be/id/publicatie-taak/')}
		PREFIX adms: ${sparqlEscapeUri('http://www.w3.org/ns/adms#')}
		PREFIX dct: ${sparqlEscapeUri('http://purl.org/dc/terms/')}
		PREFIX prov: ${sparqlEscapeUri('http://www.w3.org/ns/prov#')}
		`

export function findPressReleasesWithPublicationEvents(id) {
	return `
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
		${PREFIXES}
		
		INSERT {
			GRAPH ${sparqlEscapeUri(graph)} {
				?publicationEvent	ebucore:publicationStartDateTime 	${sparqlEscapeDateTime(dateTime)} ;
									ebucore:publishedStartDateTime 		${sparqlEscapeDateTime(dateTime)} .
			}
		} WHERE {
			GRAPH ${sparqlEscapeUri(graph)} {
				?pressRelease 		mu:uuid 							${sparqlEscapeString(pressReleaseId)} ;
							  		ebucore:isScheduledOn 				?publicationEvent .
			}
		}
	`;
}

export function getPublicationChannelsByPressReleaseUUID(graph, pressReleaseUUID) {
	return `
		${PREFIXES}
		
		SELECT ?pressRelease ?pubChannel
		WHERE {
			GRAPH ${sparqlEscapeUri(graph)} {
				?pressRelease   mu:uuid    					${sparqlEscapeString(pressReleaseUUID)} ;
								ext:publicationChannels 	?pubChannel .
			}
		}
	`

}


export function createPublicationTask(graph, publicationChannel,publicationEvent){

	return `
		${PREFIXES}
		INSERT DATA {
			GRAPH ${sparqlEscapeUri(graph)} {
		
			vlpt:${uuid()} 		a 								ext:PublicationTask ;
								adms:status 					${sparqlEscapeUri('http://themis.vlaanderen.be/id/concept/publication-task-status/not-started')} ;
						    	dct:created						${sparqlEscapeDateTime(new Date())};
						    	dct:modified					${sparqlEscapeDateTime(new Date())};
						    	ext:publicationChannel			${sparqlEscapeUri(publicationChannel)};
						    	prov:generated					${sparqlEscapeUri(publicationEvent)};
						    	mu:uuid 						${sparqlEscapeString(uuid())}  .
			}
		} 

	`
}
