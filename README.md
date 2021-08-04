# Press release Publication Tasks generator service

A microservice that generates publication tasks for publishing press releases to their assigned publication channels.

## How to

### Run the application in development mode

For development, add a docker-compose.override.yml to your main project (app-persberchten), or add the followiing service to your existng docker-compose.override.yaml.
(You might have to change the volume path to the root path of this application).

```yaml
services:
  database:
    environment:
      LOG_DELTA_MESSAGES: "on"
  publication-tasks-generator:
    image: semtech/mu-javascript-template
    ports:
      - 8888:80
      - 9229:9229
    environment:
      NODE_ENV: "development"
    links:
      - triplestore:database
    volumes:
      - ../publication-tasks-generator-service/:/app/
```

You can start the stack in development mode by running

```
docker-compose -f docker-compose.yml -f docker-compose.development.yml docker-compose.override.yml up
```

# Reference
## API

### POST /press-releases/:uuid/publish

Trigger the publication of a press-release to it's publication channels

#### Params
  - :uuid = the press release uuid 
  
Response

    200 OK on successful creation of publication  tasks.
    409 Conflict when press-release is already published
    404 Not Found if the press release with the given uuid is not found


# Model
## Used prefixes

| Prefix  | URI | 
|---|---|
| dct | http://purl.org/dc/terms/  |
| adms |  http://www.w3.org/ns/adms# |
| ext  | http://mu.semte.ch/vocabularies/ext  |
| ebucore  | http://www.ebu.ch/metadata/ontologies/ebucore/ebucore# |
| mu  | http://mu.semte.ch/vocabularies/core/ |
| vlpt  | http://themis.vlaanderen.be/id/publicatie-taak/ |
| prov  | http://www.w3.org/ns/prov# |


## Publication-task
### Class

ext:PublicationTask

#### Properties
| Name    |  Predicate   |  Definition  |
|---|---|---|
|   status  |   adms:status |  Status of the publication task, initially set to <http://themis.vlaanderen.be/id/concept/publication-task-status/not-started>  |
|   created  |   dct:created | Datetime of creation of the task  |
|   modified  |   dct:modified |  Datetime of modification of the task |
|   uuid  |  mu:uuid |  unique ID |
|   publication-channel  |  ext:publicationChannel |  publication channel the press release has to be published to |

## Press-release
### Class

fabio:PressRelease

#### Properties

| Name    |  Predicate   |  Definition  |
|---|---|---|
|    uuid                   |  mu:uuid                          |  press release uuid    |                 
|    publicationEvent       |  ebucore:isScheduledOn            |  the publication event linked to this press release with info about when and where to publish this press-release |

## Publication Event
### Class

ebucore:PublicationEvent

#### Properties

| Name    |  Predicate   |  Definition  |
|---|---|---|
|    planned-start-date        |  ebucore:publicationStartDateTime           |  the date the related press release is planned to be published |
|    started                   |  ebucore:publishedStartDateTime             |  the dateTime the related press-release has been published    |                 


#### Publication-task statuses

    http://themis.vlaanderen.be/id/concept/publication-task-status/not-started
