const network = '*'; // network abrevation (mayby '*')
const year = 2014; // the year we are observing

const minCoverage = 0.9; // ratio of the year a station has to covers to be considered
const maxSegments = 8; // maximum number of segments a station's data can have to be considerd
const maxLattitude = 90; // maximum lattitude of a station to be considerd

const refAudioRate = 48000; // audio rate
const refFrameRate = 20; // reference (common) sensor data rate

const refRatio = refAudioRate / refFrameRate;
const starttime = `${year}-01-01T00:00:00`;
const endtime = `${year + 1}-01-01T00:00:00`;
const durationOfYear = daysOfMonth(year, 13) * 24 * 60 * 60;
const maxDurationOfMonth = 31 * 24 * 60 * 60;

let stationArray = null;
let stationMap = null;

const stationButton = document.getElementById('station-button');
const requestField = document.getElementById('request-field');
//const audioButton = document.getElementById('audio-button');
const selectedStationsContainer = document.getElementById('selected-stations-container');
const stationTable = document.getElementById('station-table');
const linkTable = document.getElementById('link-table');

/**
 * request station list
 */
let numSelected = 0;

stationButton.addEventListener('click', requestStationList);
//document.addEventListener("DOMContentLoaded", requestStationList);

function requestStationList() {
  stationArray = [];
  stationMap = new Map();
  numSelected = 0;

  const availabilityUrl = makeAvailabilityUrl(network, '*', starttime, endtime);
  requestField.innerHTML = `Request URL: ${availabilityUrl}`;

  const availabilityRequest = new XMLHttpRequest();
  availabilityRequest.responseType = 'json';
  availabilityRequest.open('GET', availabilityUrl);

  availabilityRequest.addEventListener('load', () => {
    if (availabilityRequest.status === 200)
      generateStationList(availabilityRequest.response);
    else
      console.log("error in availability request");
  });

  availabilityRequest.send();
}

function generateStationList(response) {
  const stationList = response.repository[0].channels;

  for (let s of stationList) {
    const network = s.net;
    const station = s.sta;
    const framerate = s.sample_rate;
    const timespans = s.timespans;
    const id = network + '-' + station;

    if (timespans.length <= maxSegments) {
      let totalDuration = 0;

      for (let span of timespans) {
        const starttime = parseTime(span[0]);
        const endtime = parseTime(span[1]);
        const startSeconds = getSeconds(year, starttime);
        let endSeconds = getSeconds(year, endtime);
        const duration = endSeconds - startSeconds;

        totalDuration += duration;
      }

      const coverage = totalDuration / durationOfYear;

      if (coverage >= minCoverage) {
        const catalogRequest = new XMLHttpRequest();
        const catalogRequestUrl = makeCatalogRequestUrl(network, station);
        catalogRequest.responseType = 'text';
        catalogRequest.open('GET', catalogRequestUrl);

        catalogRequest.addEventListener('load', () => {
          if (catalogRequest.status === 200) {
            const response = catalogRequest.response;
            const n = response.indexOf(`${network}|${station}`);
            const str = response.substring(n, n + 40);
            const parts = str.split('|');
            const lattitude = parseFloat(parts[4]);
            const longitude = parseFloat(parts[5]);

            if (lattitude <= maxLattitude && -lattitude >= -maxLattitude) {
              const obj = {
                id,
                network,
                station,
                framerate,
                lattitude,
                longitude,
                timespans,
                coverage,
              };

              stationArray.push(obj);
              stationMap.set(id, obj);

              requestField.innerHTML = `got ${stationArray.length} of ${stationList.length} available stations`;
              displayStations();
            }
          } else {
            console.log("error in availability request");
          }
        });

        catalogRequest.send();
      }
    }
  }
}

function displayStations() {
  stationArray.sort((a, b) => a.longitude - b.longitude);

  stationTable.innerHTML = `
    <thead><tr>
      <th></th>
      <th>Network</th>
      <th>Station</th>
      <th>Framerate</th>
      <th>Lattitude</th>
      <th>Longitude</th>
      <th>Parts</th>
      <th>Coverage</th>
    </tr></thead>`;

  for (let s of stationArray) {
    const row = document.createElement('tr');

    const checkCell = document.createElement('td');
    const networkCell = document.createElement('td');
    const stationCell = document.createElement('td');
    const rateCell = document.createElement('td');
    const lattitudeCell = document.createElement('td');
    const longitudeCell = document.createElement('td');
    const segmentCell = document.createElement('td');
    const coverageCell = document.createElement('td');

    stationTable.appendChild(row);
    row.appendChild(checkCell);
    row.appendChild(networkCell);
    row.appendChild(stationCell);
    row.appendChild(rateCell);
    row.appendChild(lattitudeCell);
    row.appendChild(longitudeCell);
    row.appendChild(segmentCell);
    row.appendChild(coverageCell);

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.name = s.id;
    input.addEventListener('click', onCheck);

    checkCell.appendChild(input);
    networkCell.innerHTML = s.network;
    stationCell.innerHTML = s.station;
    rateCell.innerHTML = s.framerate;
    lattitudeCell.innerHTML = s.lattitude;
    longitudeCell.innerHTML = s.longitude;
    segmentCell.innerHTML = s.timespans.length;
    coverageCell.innerHTML = s.coverage.toFixed(3);
  }
}

function onCheck(e) {
  const target = e.target;
  const id = target.name;
  let s = stationMap.get(id);

  if (target.checked) {
    numSelected++;
    s.selected = true;
  } else {
    numSelected--;
    s.selected = false;
  }

  selectedStationsContainer.innerHTML = '<hr id="equator">';

  let first = null;
  let last = null;

  for (s of stationArray) {
    if (s.selected) {
      if (!first) {
        let box = document.createElement('div');
        box.classList.add('box');
        box.style.left = '0';
        box.style.bottom = `${50 * (s.lattitude / maxLattitude + 1)}%`;
        box.innerHTML = s.id;
        selectedStationsContainer.appendChild(box);

        box = document.createElement('div');
        box.classList.add('box');
        box.style.left = '100%';
        box.style.bottom = `${50 * (s.lattitude / maxLattitude + 1)}%`;
        box.innerHTML = s.id;
        selectedStationsContainer.appendChild(box);

        first = s;
      } else {
        let box = document.createElement('div');
        box.classList.add('box');
        box.style.left = `${100 / 360 * (s.longitude - first.longitude)}%`;
        box.style.bottom = `${50 * (s.lattitude / maxLattitude + 1)}%`;
        box.innerHTML = s.id;
        selectedStationsContainer.appendChild(box);
      }

      last = s;
    }
  }

  generateAudioList();
}

/**
 * request audio links
 */
//audioButton.addEventListener('click', generateAudioList);

function generateAudioList() {
  linkTable.innerHTML = `
    <thead><tr>
      <th>Station</th>
      <th>Audio Links</th>
      <th>Audacity Labels</th>
    </tr></thead>`;

  for (let s of stationArray) {
    if (s.selected) {
      const network = s.network;
      const station = s.station;
      const framerate = s.framerate;
      const timespans = s.timespans;
      const audiorate = refAudioRate * framerate / refFrameRate;

      const row = document.createElement('tr');
      const stationCell = document.createElement('td');
      const linkCell = document.createElement('td');
      const labelCell = document.createElement('td');

      linkTable.appendChild(row);
      row.appendChild(stationCell);
      row.appendChild(linkCell);
      row.appendChild(labelCell);

      stationCell.innerHTML = `${network} ${station}`;

      const info = {
        links: '',
        labels: '',
      };

      for (let span of timespans) {
        const starttime = parseTime(span[0]);
        const endtime = parseTime(span[1]);
        const startSeconds = getSeconds(year, starttime);
        let endSeconds = getSeconds(year, endtime);

        const duration = endSeconds - startSeconds;

        if (duration < maxDurationOfMonth) {
          addSegment(network, station, starttime, endtime, audiorate, info);
        } else {
          let month = starttime.month;
          let endMonth = endtime.month + 12 * (endtime.year - starttime.year);

          const start = getTimeObject(starttime.year, month, starttime.day, starttime.hour, starttime.minute, starttime.second);
          const end = getTimeObject(starttime.year, ++month, 1, 0, 0, 0);
          addSegment(network, station, start, end, audiorate, info);

          while (month < endMonth) {
            const start = getTimeObject(starttime.year, month, 1, 0, 0, 0);
            const end = getTimeObject(starttime.year, ++month, 1, 0, 0, 0);
            addSegment(network, station, start, end, audiorate, info);
          }

          if (end.day > 1 || end.hour > 0 || end.minute > 0 || end.second > 0) {
            const start = getTimeObject(starttime.year, month, 1, 0, 0, 0);
            const end = getTimeObject(endtime.year, endtime.month, endtime.day, endtime.hour, endtime.minute, endtime.second);
            addSegment(network, station, start, end, audiorate, info);
          }
        }
      }

      linkCell.innerHTML = info.links;
      labelCell.innerHTML = info.labels;
    }
  }
}

function addSegment(network, station, starttime, endtime, audiorate, info) {
  const startSeconds = getSeconds(year, starttime);
  const endSeconds = getSeconds(year, endtime);
  const startStr = getTimeString(starttime);
  const endStr = getTimeString(endtime);

  info.links += `<a href=${makeAudioRequestUrl(network, station, startStr, endStr, audiorate)}>${startStr} ${endStr}</a>`;
  info.links += '<br/>';

  info.labels += (startSeconds / refRatio);
  info.labels += '\t';
  info.labels += (endSeconds / refRatio);
  info.labels += '\t';
  info.labels += '"' + startStr + '"';
  info.labels += '<br/>';
}

/**
 * helper functions
 */
function parseTime(str) {
  const parts = str.split('-');

  if (parts.length === 3) {
    const year = parseInt(parts[0]);
    const month = parseInt(parts[1]);
    const dayParts = parts[2].split('T');

    if (dayParts.length === 2) {
      const day = parseInt(dayParts[0]);
      const timeParts = dayParts[1].split(':');

      if (timeParts.length === 3) {
        const hour = parseInt(timeParts[0]);
        const minute = parseInt(timeParts[1]);
        const second = parseFloat(timeParts[2]);

        return getTimeObject(year, month, day, hour, minute, second);
      }
    }
  }

  return null;
}

function numToStr2(num) {
  const prefix = (num < 10) ? '0' : '';
  return prefix + num.toString();
}

function getTimeString(time) {
  const year = time.year + Math.floor((time.month - 1) / 12);
  const month = ((time.month - 1) % 12) + 1;

  const yyyy = year.toString();
  const mm = numToStr2(month);
  const dd = numToStr2(time.day);
  const hh = numToStr2(time.hour);
  const nn = numToStr2(time.minute);
  const ss = numToStr2(time.second);

  return `${yyyy}-${mm}-${dd}T${hh}:${nn}:${ss}`;
}

function getTimeObject(year, month, day, hour, minute, second) {
  return {
    year,
    month,
    day,
    hour,
    minute,
    second,
  };
}

function daysOfMonth(year, month) {
  const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let days = 0;

  for (let i = 0; i < month - 1; i++)
    days += daysInMonth[i];

  const isLeapYear = ((year % 4 === 0) && (year % 100 !== 0)) || (year % 400 === 0);

  if (month > 2 && isLeapYear)
    days++;

  return days;
}

function dayOfYearAndMonth(refYear, year, month) {
  let days = 0;

  for (let y = refYear; y < year; y++)
    days += daysOfMonth(y, 13);

  days += daysOfMonth(year, month);

  return days;
}

function getSeconds(refYear, time) {
  return time.second + (time.minute + (time.hour + (time.day - 1 + dayOfYearAndMonth(refYear, time.year, time.month)) * 24) * 60) * 60;
}

function makeAvailabilityUrl(network, station, starttime, endtime) {
  return `https://service.iris.edu/irisws/availability/1/query?\
format=json&\
net=${network}&\
sta=${station}&\
loc=00&\
cha=BHZ&\
starttime=${starttime}&\
endtime=${endtime}&\
mergequality=false&\
mergesamplerate=false&\
mergeoverlap=false&\
showlastupdate=false&\
excludetoolarge=true&\
includerestricted=false&\
nodata=404\
`;
}

function makeAudioRequestUrl(network, station, starttime, endtime, audiorate) {
  return `https://service.iris.edu/irisws/timeseries/1/query?\
net=${network}&\
sta=${station}&\
cha=BHZ&\
start=${starttime}&\
end=${endtime}&\
format=audio&\
audiosamplerate=${audiorate}&\
loc=00&\
`;
}

function makeCatalogRequestUrl(network, station) {
  return `https://service.iris.edu/irisws/fedcatalog/1/query?\
net=${network}&\
sta=${station}&\
loc=00&\
cha=BHZ&\
format=text&
includeoverlaps=false&\
nodata=404\
`;
}