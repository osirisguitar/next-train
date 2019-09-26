'use strict';

const http = require('http');
const request = require('request-promise');
const moment = require('moment');

const templates = {
  sv: {
    noTrains: 'Det går inga tåg inom den närmaste timmen.',
    firstTrain: 'Nästa tåg mot {destination} avgår {departureTime}, vilket är {departureTimeRelative}.',
    nextTrain: 'Tåget efter det mot {destination} avgår {departureTime}, vilket är {departureTimeRelative}.'
  },
  en: {
    noTrains: 'There are no trains leaving within the next hour.',
    firstTrain: 'The next train headed for {destination} leaves at {departureTime}, which is {departureTimeRelative}.',
    nextTrain: 'The one after that headed for {destination} leaves at {departureTime}, which is {departureTimeRelative}.'
  }
}

const server = http.createServer((req, res) => {
  if (req.url.indexOf('?') > 0) {
    const queryString = req.url.split('?')[1];
    const pairs = queryString.split('&');
    let queryParameters = {};

    pairs.forEach(pair => {
      queryParameters[pair.split('=')[0]] = pair.split('=')[1];
    });

    if (queryParameters.destinations) {
      queryParameters.destinations = queryParameters.destinations.split(',')
      queryParameters.destinations = queryParameters.destinations.map(destination => {
        return decodeURI(destination)
      })
    }

    let currentTemplates = templates.en;
    if (queryParameters.lang === 'sv') {
      currentTemplates = templates.sv;
    }

    return getSiteId(queryParameters.station)
      .then(siteId => {
        return getNextDepartures(siteId, parseInt(queryParameters.direction, 10), queryParameters.destinations);
      })
      .then(nextTrains => {
        let resultString;
        let deviations = [];

        if (nextTrains.length === 0) {
          resultString = currentTemplates.noTrains;
        } else if (nextTrains.length > 0) {
          resultString = currentTemplates.firstTrain;
          resultString = createDepartureString(resultString, nextTrains[0], queryParameters.lang);

          if (nextTrains[0].Deviations) {
            deviations.push(nextTrain[0].Deviations)
          }

          if (nextTrains.length > 1) {
            resultString += ' ' + createDepartureString(currentTemplates.nextTrain, nextTrains[1], queryParameters.lang);
            if (nextTrains[1].Deviations) {
              deviations.push(nextTrains[1].Deviations)
            }
          }
        }

        let result = {
          speech: resultString,
          displayText: resultString,
          source: 'NextTrain',
          deviations
        };

        res.setHeader('Content-Type', 'application/json');
        res.write(JSON.stringify(result));
        res.end();
      });
  } else {
    res.end();
  }
});

server.listen(7070);

function createDepartureString (templateString, trainDeparture, language) {
  let departureTime = moment(trainDeparture.ExpectedDateTime);

  let departureString = templateString.replace('{destination}', trainDeparture.Destination).replace('{departureTime}', departureTime.format('HH:mm'));

  if (trainDeparture.DisplayTime.match(/^1 min/)) {
    departureString = departureString.replace('{departureTimeRelative}', (language === 'sv' ? 'om 1 minut' : ' in 1 minute'));
  } else if (trainDeparture.DisplayTime.indexOf('min') !== -1) {
    let inString = (language === 'sv' ? 'om' : 'in');
    let minuteString = (language === 'sv' ? 'minuter' : 'minutes');
    departureString = departureString.replace('{departureTimeRelative}', `${inString} ${trainDeparture.DisplayTime.replace('min', minuteString)}`);
  } else if (trainDeparture.DisplayTime.indexOf('Nu') !== -1) {
    departureString = departureString.replace('{departureTimeRelative}', (language === 'sv' ? 'nu' : 'now'));
  } else {
    departureString = departureString.replace((language === 'sv' ? ', vilket är {departureTimeRelative}' : ', which is {departureTimeRelative}'), '')
  }

  if (language !== 'sv') {
    departureString = departureString.replace('ä', 'eh').replace('Ä', 'Eh').replace('å', 'aw').replace('Å', 'Aw').replace('ö', 'eh').replace('Ö', 'eh');
  }

  return departureString
}

let siteIds = {}

function getSiteId (siteName) {
  if (siteIds[siteName]) {
    return Promise.resolve(siteIds[siteName])
  } else {
    return request(`http://api.sl.se/api2/typeahead.json?key=5fb98da67b114cbfa9c02a3df76905ca&searchstring=${siteName}&stationsonly=true&maxresults=1`)
      .then(response => {
        response = JSON.parse(response)
        console.log(response)
        // { StatusCode: 1007, Message: 'Too many requests per month' }
        siteIds[siteName] = response.ResponseData[0].SiteId
        return siteIds[siteName]
      });
  }
}

function getNextDepartures (siteId, direction, destinations) {
  return request(`http://api.sl.se/api2/realtimedeparturesV4.json?key=f6227d99bfb844b4be7093c06ff11858&siteid=${siteId}&timewindow=60&bus=false&tram=false&ship=false&metro=false`)
    .then(departures => {
      departures = JSON.parse(departures);

      departures = departures.ResponseData.Trains.filter(departure => {
        return departure.JourneyDirection === direction;
      });

      if (destinations) {
        departures = departures.filter(departure => {
          return destinations.some(destination => {
            return destination.toLowerCase() == departure.Destination.toLowerCase()
          })
        })
      }

      return departures;
    });
}
