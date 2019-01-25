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
    noTrains: 'There are no trains leaving within the next hour',
    firstTrain: 'The next train headed for {destination} leaves at {departureTime}, which is {departureTimeRelative}',
    nextTrain: 'The one after that headed for {destination} leaves at {departureTime}, which is {departureTimeRelative}'
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

    let currentTemplates = templates.en;
    if (queryParameters.lang === 'sv') {
      currentTemplates = templates.sv;
    }

    return getSiteId(queryParameters.station)
      .then(siteId => {
        return getNextDepartures(siteId, parseInt(queryParameters.direction, 10));
      })
      .then(nextTrains => {
        let resultString;

        if (nextTrains.length === 0) {
          resultString = currentTemplates.noTrains;
        } else if (nextTrains.length > 0) {
          resultString = currentTemplates.firstTrain;
          resultString = createDepartureString(resultString, nextTrains[0], queryParameters.lang);

          if (nextTrains.length > 1) {
            resultString += ' ' + createDepartureString(currentTemplates.nextTrain, nextTrains[1], queryParameters.lang);
          }
        }

        let result = {
          speech: resultString,
          displayText: resultString,
          source: 'NextTrain'
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

  if (trainDeparture.DisplayTime.indexOf('1 min') !== -1) {
    departureString = departureString.replace('{departureTimeRelative}', (language === 'sv' ? '1 minut' : '1 minute'));
  } else if (trainDeparture.DisplayTime.indexOf('min') !== -1) {
    let inString = (language === 'sv' ? 'om' : 'in');
    let minuteString = (language === 'sv' ? 'minuter' : 'minutes');
    departureString = departureString.replace('{departureTimeRelative}', `${inString} ${trainDeparture.DisplayTime.replace('min', minuteString)}`);
  } else if (trainDeparture.DisplayTime.indexOf('Nu') !== -1) {
    departureString = departureString.replace('{departureTimeRelative}' , (language === 'sv' ? 'nu' : 'now'));
  } 

  if (language !== 'sv') {
    departureString = departureString.replace('ä', 'eh').replace('Ä', 'Eh').replace('å', 'aw').replace('Å', 'Aw').replace('ö', 'eh').replace('Ö', 'eh');
  }

  return departureString
}

function getSiteId (siteName) {
  return request(`http://api.sl.se/api2/typeahead.json?key=73518a557fcf43e196111f14dd21a185&searchstring=${siteName}&stationsonly=true&maxresults=1`)
    .then(response => {
      response = JSON.parse(response);
      return response.ResponseData[0].SiteId;
    });
}

function getNextDepartures (siteId, direction) {
  return request(`http://api.sl.se/api2/realtimedeparturesV4.json?key=f6227d99bfb844b4be7093c06ff11858&siteid=${siteId}&timewindow=60&bus=false&tram=false&ship=false&metro=false`)
    .then(departures => {
      departures = JSON.parse(departures);


      departures = departures.ResponseData.Trains.filter(departure => {
        return departure.JourneyDirection === direction;
      });

      return departures;
    });
}
