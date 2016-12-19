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

    console.log(queryParameters);

    return getSiteId(queryParameters.station)
      .then(siteId => {
        return getNextDepartures(siteId, parseInt(queryParameters.direction, 10));
      })
      .then(nextTrains => {
        let resultString;

        if (nextTrains.length === 0) {
          resultString = 'There are no trains leaving within the next half hour';
        } else if (nextTrains.length > 0) {
          let departureTime = moment(nextTrains[0].ExpectedDateTime);
          resultString = `The next train for ${nextTrains[0].Destination} leaves at ${departureTime.format('HH:MM')} which is in ${nextTrains[0].DisplayTime.replace('min', 'minutes')}.`;

          if (nextTrains.length > 1) {
            let nextDepartureTime = moment(nextTrains[1].ExpectedDateTime);
            resultString += ` The one after that for ${nextTrains[1].Destination} leaves at ${nextDepartureTime.format('HH:MM')} which is in ${nextTrains[1].DisplayTime.replace('min', 'minutes')}.`;
          }
        }
        console.log('nextTrains', nextTrains);
        res.write(resultString);
        res.end();
      });
  } else {
    res.end();
  }
});

server.listen(7070);

function getSiteId (siteName) {
  return request(`http://api.sl.se/api2/typeahead.json?key=73518a557fcf43e196111f14dd21a185&searchstring=${siteName}&stationsonly=true&maxresults=1`)
    .then(response => {
      response = JSON.parse(response);
      console.log(response);
      return response.ResponseData[0].SiteId;
    });
}

function getNextDepartures (siteId, direction) {
  return request(`http://api.sl.se/api2/realtimedeparturesV4.json?key=f6227d99bfb844b4be7093c06ff11858&siteid=${siteId}&timewindow=30&bus=false&tram=false&ship=false&metro=false`)
    .then(departures => {
      departures = JSON.parse(departures);

      console.log('trains', departures.ResponseData.Trains);

      departures = departures.ResponseData.Trains.filter(departure => {
        console.log('Checking', typeof departure.JourneyDirection, typeof direction);
        return departure.JourneyDirection === direction;
      });

      console.log('filtered', departures);

      return departures;
    });
}
