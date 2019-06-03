const button = document.getElementById('button');

const network = 'G';
const year = 2014;
const starttime = `${year}-01-01T00:00:00`;
const endtime = `${year + 1}-01-01T00:00:00`;

const refAudioRate = 48000;
const refFramerate = 20;
const refRatio = refAudioRate / refFramerate;

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

function makeAvailabilityUrl(network, starttime, endtime) {
  return `https://service.iris.edu/irisws/availability/1/query?\
format=json&\
net=${network}&\
sta=*&\
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
nodata=404`;
}

function makeAudioDataUrl(network, station, starttime, endtime, audiorate) {
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

function addSpan(network, station, starttime, endtime, audiorate) {
  const startSeconds = getSeconds(year, starttime);
  const endSeconds = getSeconds(year, endtime);
  const startStr = getTimeString(starttime);
  const endStr = getTimeString(endtime);

  const url = makeAudioDataUrl(network, station, startStr, endStr, audiorate);
  console.log(url);

  let label = (startSeconds / refRatio);
  label += '\t';
  label += (endSeconds / refRatio);
  label += '\t';
  label += '"' + startStr + '"';
  label += '\n';

  return label;
}

const availabilityUrl = makeAvailabilityUrl(network, starttime, endtime);

const durationOfYear = daysOfMonth(year, 13) * 24 * 60 * 60;
const maxDurationOfMonth = 31 * 24 * 60 * 60;

button.addEventListener('click', () => {
  console.log("sending request:", availabilityUrl);

  const availabilityRequest = new XMLHttpRequest();
  availabilityRequest.responseType = 'json';
  availabilityRequest.open('GET', availabilityUrl);

  availabilityRequest.addEventListener('load', () => {
    if (availabilityRequest.status === 200) {
      const response = availabilityRequest.response;
      const stationList = response.repository[0].channels;
      const stations = new Map();

      for (let s of stationList) {
        const network = s.net;
        const station = s.sta;
        const framerate = s.sample_rate;
        const timespans = s.timespans;
        const id = network + '-' + station;

        if (timespans.length < 8) {
          const audiorate = refAudioRate * framerate / refFramerate;
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

          if (coverage > 0.5) {
            console.log('------------------------------------------------------------------------------');
            console.log(network, station, framerate, timespans.length, coverage);

            stations.set(id, {
              network,
              station,
              framerate,
            });

            let labels = '';

            for (let span of timespans) {
              const starttime = parseTime(span[0]);
              const endtime = parseTime(span[1]);
              const startSeconds = getSeconds(year, starttime);
              let endSeconds = getSeconds(year, endtime);

              const duration = endSeconds - startSeconds;

              if (duration < maxDurationOfMonth) {
                labels += addSpan(network, station, starttime, endtime, audiorate);
              } else {
                let month = starttime.month;
                let endMonth = endtime.month + 12 * (endtime.year - starttime.year);

                const start = getTimeObject(starttime.year, month, starttime.day, starttime.hour, starttime.minute, starttime.second);
                const end = getTimeObject(starttime.year, ++month, 1, 0, 0, 0);
                labels += addSpan(network, station, start, end, audiorate);

                while (month < endMonth) {
                  const start = getTimeObject(starttime.year, month, 1, 0, 0, 0);
                  const end = getTimeObject(starttime.year, ++month, 1, 0, 0, 0);
                  labels += addSpan(network, station, start, end, audiorate);
                }

                if (end.day > 1 || end.hour > 0 || end.minute > 0 || end.second > 0) {
                  const start = getTimeObject(starttime.year, month, 1, 0, 0, 0);
                  const end = getTimeObject(endtime.year, endtime.month, endtime.day, endtime.hour, endtime.minute, endtime.second);
                  labels += addSpan(network, station, start, end, audiorate);
                }
              }
            }

            console.log('---------------------------------------');
            console.log(labels);
          }
        }
      }

      console.log(`${stations.size} of ${stationList.length}`);
      console.log(stations);
    } else {
      console.log("something went wrong");
    }
  });

  availabilityRequest.send();
});