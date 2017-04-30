'use strict';

const http = require('http');
const request = require('request-promise');
const moment = require('moment');

const server = http.createServer((req, res) => {
  if (req.url.indexOf('?') > 0) {
    const queryString = req.url.split('?')[1];
    const pairs = queryString.split('&');
    let queryParameters = {};

    pairs.forEach(pair => {
      queryParameters[pair.split('=')[0]] = pair.split('=')[1];
    });

    return getSiteId(queryParameters.station)
      .then(siteId => {
        return getNextDepartures(siteId, parseInt(queryParameters.direction, 10));
      })
      .then(nextTrains => {
        let resultString;

        if (nextTrains.length === 0) {
          resultString = 'There are no trains leaving within the next hour';
        } else if (nextTrains.length > 0) {
          resultString = `The next train ${createDepartureString(nextTrains[0])}`;

          if (nextTrains.length > 1) {
            resultString += ` The one after that ${createDepartureString(nextTrains[1])}`;
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

function createDepartureString (trainDeparture) {
  let departureTime = moment(trainDeparture.ExpectedDateTime);
  let departureString = `headed for ${trainDeparture.Destination} leaves at ${departureTime.format('HH:mm')}`;

  if (trainDeparture.DisplayTime.indexOf('1 min') > 0) {
    departureString += ` which is in ${trainDeparture.DisplayTime.replace('min', 'minute')}.`;
  } else if (trainDeparture.DisplayTime.indexOf('min') > 0) {
    departureString += ` which is in ${trainDeparture.DisplayTime.replace('min', 'minutes')}.`;
  } else if (trainDeparture.DisplayTime.indexOf('Nu') > 0) {
    departureString += ` which is now.`;
  } else {
    departureString += '.';
  }

  return departureString.replace('ä', 'eh').replace('Ä', 'Eh').replace('å', 'aw').replace('Å', 'Aw').replace('ö', 'eh').replace('Ö', 'eh');
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
