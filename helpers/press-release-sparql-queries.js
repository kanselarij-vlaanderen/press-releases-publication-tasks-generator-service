import { sparqlEscapeString, sparqlEscapeUri, sparqlEscapeDateTime, uuid } from 'mu';
import { querySudo as query, updateSudo as update } from '@lblod/mu-auth-sudo';

const PREFIXES = `
		PREFIX mu: ${sparqlEscapeUri('http://mu.semte.ch/vocabularies/core/')}
		PREFIX ebucore: ${sparqlEscapeUri('http://www.ebu.ch/metadata/ontologies/ebucore/ebucore#')}
		PREFIX ext: ${sparqlEscapeUri('http://mu.semte.ch/vocabularies/ext/')}
		PREFIX vlpt: ${sparqlEscapeUri('http://themis.vlaanderen.be/id/publicatie-taak/')}
		PREFIX adms: ${sparqlEscapeUri('http://www.w3.org/ns/adms#')}
		PREFIX dct: ${sparqlEscapeUri('http://purl.org/dc/terms/')}
		PREFIX prov: ${sparqlEscapeUri('http://www.w3.org/ns/prov#')}
		`;

export async function findPressReleaseWithPublicationEvent(id) {
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

}

export async function removeFuturePublicationDate(graph, pressRelease) {
  return await update(`
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

export async function startPublicationByPressRelease(graph, pressRelease, dateTime) {
  return await update(`
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

export async function startPublicationByPublicationEvent(graph, publicationEvent, dateTime) {
  return await update(`
		${PREFIXES}

		INSERT DATA {
			GRAPH ${sparqlEscapeUri(graph)} {
				${sparqlEscapeUri(publicationEvent)} ebucore:publicationStartDateTime ${sparqlEscapeDateTime(dateTime)} .
			}
		}
	`);

}


export async function getPublicationChannelsByPressRelease(graph, pressRelease) {
  return await query(`
		${PREFIXES}

		SELECT ?pressRelease ?pubChannel
		WHERE {
			GRAPH ${sparqlEscapeUri(graph)} {
				${sparqlEscapeUri(pressRelease)}		ebucore:isScheduledOn 				?publicationEvent .
				?pubChannel						        ebucore:hasChannelPublicationEvent 	?publicationEvent .
			}
		}
	`);

}

export async function getPublicationChannelsByPublicationEvent(graph, publicationEvent) {
  return await query(`
		${PREFIXES}

		SELECT ?pubChannel
		WHERE {
			GRAPH ${sparqlEscapeUri(graph)} {
				?pubChannel	ebucore:hasChannelPublicationEvent 	${sparqlEscapeUri(publicationEvent)} .
			}
		}
	`);

}

export async function createPublicationTask(graph, publicationChannel, publicationEvent) {
  const newId = uuid();
  const notStartedURI = 'http://themis.vlaanderen.be/id/concept/publication-task-status/not-started';
  const now = new Date();

  return update(`
		${PREFIXES}
		INSERT DATA {
			GRAPH ${sparqlEscapeUri(graph)} {

			vlpt:${newId} 		a 								ext:PublicationTask ;
								adms:status 					${sparqlEscapeUri(notStartedURI)} ;
						    	dct:created						${sparqlEscapeDateTime(now)};
						    	dct:modified					${sparqlEscapeDateTime(now)};
						    	ext:publicationChannel			${sparqlEscapeUri(publicationChannel)};
						    	mu:uuid 						${sparqlEscapeString(newId)}  .

			${sparqlEscapeUri(publicationEvent)} 	prov:generated		vlpt:${newId} .
			}
		}

	`);
}

export async function createTasksByPressRelease(graph, pressRelease, publicationEvent) {
  const publicationChannels = (await getPublicationChannelsByPressRelease(graph, pressRelease)).results.bindings;
  if (publicationChannels.length) {
    console.info(`Press-release of publication event ${publicationEvent} must be published on ${publicationChannels.length} publication-channels`);
  } else {
    console.info(`No publication-channels selected for publication event ${publicationEvent}`);
  }

  for (let publicationChannel of publicationChannels) {
    await createPublicationTask(graph, publicationChannel.pubChannel.value, publicationEvent);
  }

  return;
}

export async function createTasksByPublicationEvent(graph, publicationEvent) {
  const publicationChannels = (await getPublicationChannelsByPublicationEvent(graph, publicationEvent)).results.bindings;
  if (publicationChannels.length) {
    console.info(`Press-release of publication event ${publicationEvent} must be published on ${publicationChannels.length} publication-channels`);
  } else {
    console.info(`No publication-channels selected for publication event ${publicationEvent}`);
  }

  for (let publicationChannel of publicationChannels) {
    await createPublicationTask(graph, publicationChannel.pubChannel.value, publicationEvent);
  }
}


export async function findPlannedPublicationEvents() {
  const now = new Date();
  const queryResult = await query(`
			${PREFIXES}

			SELECT ?graph ?publicationEvent
			 WHERE {
				GRAPH ?graph {
					{
						?publicationEvent a ebucore:PublicationEvent ;
						    ebucore:publishedStartDateTime ?plannedStart .
						FILTER ( ?plannedStart <= ${sparqlEscapeDateTime(now)} )
						FILTER NOT EXISTS { ?publicationEvent ebucore:publicationStartDateTime ?started . }
					}
				}
			 }
	`);

  return queryResult.results.bindings.map((binding) => {
    return {
      graph: binding.graph.value,
      publicationEvent: binding.publicationEvent.value,
    };
  });
}
