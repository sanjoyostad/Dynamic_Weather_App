const API_KEY = 'PUT_YOUR_API_KEY_HERE';
const BASE_URL = 'https://api.openweathermap.org/data/2.5/';
const GEOCODING_BASE_URL = 'https://api.openweathermap.org/geo/1.0/';

let currentLocationTimezoneOffsetSeconds = 0;

function getWeatherIcon(iconCode) {
    if (!iconCode) return '❓';
    switch (iconCode.substring(0, 2)) {
        case '01': return '☀️';
        case '02': return '🌤️';
        case '03': return '☁️';
        case '04': return '☁️';
        case '09': return '🌧️';
        case '10': return '🌧️';
        case '11': return '⛈️';
        case '13': return '❄️';
        case '50': return '🌫️';
        default: return '❓';
    }
}

function updateDateTime(offsetSeconds = 0) {
    const now = new Date();
    const utcMs = now.getTime() + (now.getTimezoneOffset() * 60 * 1000);
    const targetMs = utcMs + (offsetSeconds * 1000);
    const targetDate = new Date(targetMs);
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    document.getElementById('date-time').textContent = targetDate.toLocaleDateString('en-US', options);
}

updateDateTime(currentLocationTimezoneOffsetSeconds);
setInterval(() => updateDateTime(currentLocationTimezoneOffsetSeconds), 60000);

const cityInput = document.getElementById('city-input');
const suggestionsContainer = document.getElementById('suggestions-container');
const locationDisplay = document.getElementById('location-display');
const weatherIcon = document.getElementById('weather-icon');
const temperature = document.getElementById('temperature');
const condition = document.getElementById('condition');
const humidity = document.getElementById('humidity');
const windSpeed = document.getElementById('wind-speed');
const precipitation = document.getElementById('precipitation');
const forecastContainer = document.getElementById('forecast-container');
const errorMessage = document.getElementById('error-message');

let debounceTimeout;

async function getCitySuggestions(query) {
    if (query.length < 3) {
        suggestionsContainer.innerHTML = '';
        return;
    }

    try {
        const response = await fetch(`${GEOCODING_BASE_URL}direct?q=${query}&limit=5&appid=${API_KEY}`);
        if (!response.ok) {
            throw new Error(`Error fetching city suggestions: ${response.statusText}`);
        }
        const data = await response.json();
        displaySuggestions(data);
    } catch (error) {
        console.error('Error getting city suggestions:', error);
        suggestionsContainer.innerHTML = '';
    }
}

function displaySuggestions(cities) {
    suggestionsContainer.innerHTML = '';

    if (cities.length === 0) {
        return;
    }

    cities.forEach(city => {
        const suggestionItem = document.createElement('div');
        suggestionItem.className = 'suggestion-item';
        let displayName = city.name;
        if (city.state) {
            displayName += `, ${city.state}`;
        }
        if (city.country) {
            displayName += `, ${city.country}`;
        }
        suggestionItem.textContent = displayName;
        suggestionItem.dataset.city = city.name;
        if (city.state) {
            suggestionItem.dataset.state = city.state;
        }
        if (city.country) {
            suggestionItem.dataset.country = city.country;
        }

        suggestionItem.addEventListener('click', () => {
            let fullCityName = city.name;
            if (city.state) fullCityName += `, ${city.state}`;
            if (city.country) fullCityName += `, ${city.country}`;

            cityInput.value = fullCityName;
            suggestionsContainer.innerHTML = '';
            getWeatherData(fullCityName);
        });
        suggestionsContainer.appendChild(suggestionItem);
    });
}

async function getWeatherData(city) {
    locationDisplay.textContent = 'Loading...';
    weatherIcon.textContent = '';
    weatherIcon.className = 'weather-icon relative';
    temperature.textContent = '--°C';
    condition.textContent = 'Fetching data...';
    condition.classList.add('loading-text');
    humidity.textContent = '--%';
    windSpeed.textContent = '-- km/h';
    precipitation.textContent = '-- mm';
    forecastContainer.innerHTML = '<p class="text-center text-teal-200 loading-text">Loading forecast...</p>';
    errorMessage.classList.add('hidden');

    try {
        const currentWeatherResponse = await fetch(`${BASE_URL}weather?q=${city}&appid=${API_KEY}&units=metric`);
        if (!currentWeatherResponse.ok) {
            if (currentWeatherResponse.status === 404) {
                throw new Error('City not found. Please check the spelling.');
            }
            throw new Error(`Error fetching current weather: ${currentWeatherResponse.statusText}`);
        }
        const currentWeatherData = await currentWeatherResponse.json();

        currentLocationTimezoneOffsetSeconds = currentWeatherData.timezone;
        updateDateTime(currentLocationTimezoneOffsetSeconds);

        const forecastResponse = await fetch(`${BASE_URL}forecast?q=${city}&appid=${API_KEY}&units=metric`);
        if (!forecastResponse.ok) {
            throw new Error(`Error fetching forecast: ${forecastResponse.statusText}`);
        }
        const forecastData = await forecastResponse.json();

        locationDisplay.textContent = `${currentWeatherData.name}, ${currentWeatherData.sys.country}`;
        condition.classList.remove('loading-text');

        const iconEmoji = getWeatherIcon(currentWeatherData.weather[0].icon);
        weatherIcon.textContent = iconEmoji;

        weatherIcon.className = 'weather-icon relative';
        if (iconEmoji === '☀️') {
            weatherIcon.classList.add('sunny');
        } else if (iconEmoji === '🌤️' || iconEmoji === '☁️') {
            weatherIcon.classList.add('cloudy');
        } else if (iconEmoji === '🌧️') {
            weatherIcon.classList.add('rainy');
        } else if (iconEmoji === '❄️') {
            weatherIcon.classList.add('snowy');
        }

        temperature.textContent = `${Math.round(currentWeatherData.main.temp)}°C`;
        condition.textContent = currentWeatherData.weather[0].description;
        humidity.textContent = `${currentWeatherData.main.humidity}%`;
        windSpeed.textContent = `${(currentWeatherData.wind.speed * 3.6).toFixed(1)} km/h`;
        const precipitationValue = (currentWeatherData.rain && currentWeatherData.rain['1h'] !== undefined) ? currentWeatherData.rain['1h'] :
                                 (currentWeatherData.snow && currentWeatherData.snow['1h'] !== undefined) ? currentWeatherData.snow['1h'] : 0;
        precipitation.textContent = `${precipitationValue.toFixed(1)} mm`;

        forecastContainer.innerHTML = '';
        const dailyForecasts = {};

        forecastData.list.forEach(item => {
            const date = new Date(item.dt * 1000);
            const day = date.toLocaleDateString('en-US', { weekday: 'short' });
            const dateKey = date.toISOString().split('T')[0];

            if (!dailyForecasts[dateKey]) {
                dailyForecasts[dateKey] = {
                    day: day,
                    minTemp: item.main.temp,
                    maxTemp: item.main.temp,
                    conditions: [],
                    icons: []
                };
            }
            dailyForecasts[dateKey].minTemp = Math.min(dailyForecasts[dateKey].minTemp, item.main.temp_min);
            dailyForecasts[dateKey].maxTemp = Math.max(dailyForecasts[dateKey].maxTemp, item.main.temp_max);
            dailyForecasts[dateKey].conditions.push(item.weather[0].description);
            dailyForecasts[dateKey].icons.push(item.weather[0].icon);
        });

        const forecastDays = Object.keys(dailyForecasts)
            .sort()
            .slice(0, 5);

        forecastDays.forEach(dateKey => {
            const dayData = dailyForecasts[dateKey];
            const displayDay = dayData.day;
            const displayMinTemp = Math.round(dayData.minTemp);
            const displayMaxTemp = Math.round(dayData.maxTemp);

            const mostFrequentIcon = dayData.icons.reduce((a, b, i, arr) =>
                (arr.filter(v => v === a).length >= arr.filter(v => v === b).length ? a : b), dayData.icons[0]);

            const forecastItem = document.createElement('div');
            forecastItem.className = 'forecast-item p-5 rounded-lg flex items-center justify-between shadow-lg';
            forecastItem.innerHTML = `
                <p class="font-medium text-xl">${displayDay}</p>
                <span class="text-4xl">${getWeatherIcon(mostFrequentIcon)}</span>
                <p class="text-xl">${displayMaxTemp}° / ${displayMinTemp}°</p>
            `;
            forecastContainer.appendChild(forecastItem);
        });

    } catch (error) {
        errorMessage.textContent = error.message;
        errorMessage.classList.remove('hidden');
        console.error('Error fetching weather data:', error);
        currentLocationTimezoneOffsetSeconds = 0;
        updateDateTime(currentLocationTimezoneOffsetSeconds);

        locationDisplay.textContent = 'City, Country';
        weatherIcon.textContent = '';
        weatherIcon.className = 'weather-icon relative';
        temperature.textContent = '--°C';
        condition.textContent = 'Error';
        condition.classList.remove('loading-text');
        humidity.textContent = '--%';
        windSpeed.textContent = '-- km/h';
        precipitation.textContent = '-- mm';
        forecastContainer.innerHTML = '<p class="text-center text-red-300">Failed to load forecast.</p>';
    }
}

cityInput.addEventListener('input', () => {
    clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(() => {
        getCitySuggestions(cityInput.value.trim());
    }, 300);
});

cityInput.addEventListener('blur', () => {
    setTimeout(() => {
        suggestionsContainer.innerHTML = '';
    }, 150);
});

document.getElementById('search-button').addEventListener('click', () => {
    const cityInputValue = cityInput.value.trim();
    if (cityInputValue) {
        getWeatherData(cityInputValue);
        suggestionsContainer.innerHTML = '';
    } else {
        errorMessage.textContent = 'Please enter a city name.';
        errorMessage.classList.remove('hidden');
    }
});

document.getElementById('city-input').addEventListener('keypress', (event) => {
    if (event.key === 'Enter') {
        document.getElementById('search-button').click();
    }
});

getWeatherData('London');
