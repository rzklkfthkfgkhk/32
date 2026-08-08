/**
 * НАСТРОЙКИ ДЛЯ ВАШИХ ВИДЕОФАЙЛОВ
 * 
 * Измените этот URL на адрес вашего локального или сетевого хранилища.
 * Конструктор ниже подставит ID аниме и номер серии для генерации ссылок.
 */
const MY_VIDEO_BASE_URL = "https://your-storage-host.com";

/**
 * Функция генерации ссылки на видеофайл серии.
 * Настраивается под вашу структуру хранения папок и файлов.
 * 
 * Пример вывода: vlc://https://your-storage-host.com/12345/ep_1.mp4
 */
function generateVlcLink(animeId, episodeNum) {
    const directVideoUrl = `${MY_VIDEO_BASE_URL}/${animeId}/ep_${episodeNum}.mp4`;
    return `vlc://${directVideoUrl}`;
}

// Константы API Shikimori
const SHIKIMORI_BASE = "https://shikimori.one";
const API_URL = `${SHIKIMORI_BASE}/api/animes`;

// DOM элементы
const animeGrid = document.getElementById('anime-grid');
const loadingIndicator = document.getElementById('loading');
const searchInput = document.getElementById('search-input');
const genreSelect = document.getElementById('genre-select');
const logoBtn = document.getElementById('logo-btn');
const modal = document.getElementById('anime-modal');
const modalContent = document.getElementById('modal-body-content');
const closeModalBtn = document.querySelector('.close-modal');

// Состояние приложения
let currentSearch = "";
let currentGenre = "";

// Список популярных ID жанров Shikimori (для фильтра)
const popularGenres = [
    { id: "1", name: "Экшен" },
    { id: "2", name: "Приключения" },
    { id: "4", name: "Комедия" },
    { id: "8", name: "Драма" },
    { id: "10", name: "Фэнтези" },
    { id: "14", name: "Ужасы" },
    { id: "7", name: "Детектив" },
    { id: "22", name: "Романтика" },
    { id: "24", name: "Фантастика" },
    { id: "30", name: "Спорт" }
];

// Инициализация приложения
document.addEventListener('DOMContentLoaded', () => {
    populateGenres();
    fetchAnimeList();
    setupEventListeners();
});

// Заполнение выпадающего списка жанров
function populateGenres() {
    popularGenres.forEach(genre => {
        const option = document.createElement('option');
        option.value = genre.id;
        option.textContent = genre.name;
        genreSelect.appendChild(option);
    });
}

// Настройка слушателей событий
function setupEventListeners() {
    // Живой поиск с задержкой (Debounce)
    let searchTimeout;
    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        currentSearch = e.target.value.trim();
        searchTimeout = setTimeout(() => fetchAnimeList(), 500);
    });

    // Изменение жанра
    genreSelect.addEventListener('change', (e) => {
        currentGenre = e.target.value;
        fetchAnimeList();
    });

    // Сброс фильтров при клике на логотип
    logoBtn.addEventListener('click', () => {
        searchInput.value = "";
        genreSelect.value = "";
        currentSearch = "";
        currentGenre = "";
        fetchAnimeList();
    });

    // Закрытие модального окна
    closeModalBtn.addEventListener('click', closeModal);
    window.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });
}

// Получение списка аниме из API Shikimori
async function fetchAnimeList() {
    loadingIndicator.style.display = 'block';
    animeGrid.innerHTML = '';

    try {
        // Формирование параметров запроса
        const params = new URLSearchParams({
            limit: 20,
            order: 'popularity',
            kind: 'tv' // Фильтр только на ТВ-сериалы
        });

        if (currentSearch) params.append('search', currentSearch);
        if (currentGenre) params.append('genre', currentGenre);

        const response = await fetch(`${API_URL}?${params.toString()}`);
        if (!response.ok) throw new Error('Ошибка сети при запросе к API');
        
        const animeList = await response.json();
        
        loadingIndicator.style.display = 'none';
        
        if (animeList.length === 0) {
            animeGrid.innerHTML = '<div class="loading">Ничего не найдено.</div>';
            return;
        }

        renderCards(animeList);
    } catch (error) {
        console.error('Ошибка:', error);
        loadingIndicator.innerHTML = 'Не удалось загрузить данные. Проверьте подключение.';
    }
}

// Отрисовка карточек аниме в сетку
function renderCards(animes) {
    animes.forEach(anime => {
        const card = document.createElement('div');
        card.classList.add('anime-card');
        
        // Абсолютный путь к постеру через базовый URL Шикимори
        const posterUrl = anime.image?.original ? `${SHIKIMORI_BASE}${anime.image.original}` : 'https://placeholder.com';
        const score = anime.score || '—.—';
        const episodesCount = anime.episodes === 0 ? 'Выходит' : `${anime.episodes} эп.`;

        card.innerHTML = `
            <div class="poster-wrapper">
                <img src="${posterUrl}" alt="${anime.russian || anime.name}" loading="lazy">
            </div>
            <div class="anime-card-info">
                <div class="anime-card-title" title="${anime.russian || anime.name}">${anime.russian || anime.name}</div>
                <div class="anime-card-meta">
                    <span class="rating">★ ${score}</span>
                    <span>${episodesCount}</span>
                </div>
            </div>
         Ramos`;

        // Открытие детальной информации по клику
        card.addEventListener('click', () => openAnimeDetails(anime.id));
        animeGrid.appendChild(card);
    });
}

// Получение подробной информации об аниме для модального окна
async function openAnimeDetails(id) {
    try {
        const response = await fetch(`${API_URL}/${id}`);
        if (!response.ok) throw new Error('Не удалось получить детали тайтла');
        
        const details = await response.json();
        renderModalContent(details);
        
        // Показ модалки с плавной анимацией
        modal.classList.add('show');
        document.body.style.overflow = 'hidden'; // Запрет прокрутки основного экрана
    } catch (error) {
        console.error('Ошибка при загрузке деталей:', error);
        alert('Не удалось загрузить подробную информацию.');
    }
}

// Отрисовка внутренностей модального окна
function renderModalContent(anime) {
    const posterUrl = anime.image?.original ? `${SHIKIMORI_BASE}${anime.image.original}` : 'https://placeholder.com';
    const genres = anime.genres ? anime.genres.map(g => g.russian).join(', ') : 'Не указаны';
    
    // Перевод статуса на русский язык
    const statusMap = { 'ongoing': 'Выходит', 'released': 'Вышло', 'anons': 'Анонс' };
    const status = statusMap[anime.status] || anime.status;

    // Определяем количество серий для генерации кнопок
    // Если серий в базе 0 (еще не вышло ни одной), берем плановое количество, либо ставим заглушку в 12 серий
    const totalEpisodes = anime.episodes > 0 ? anime.episodes : (anime.episodes_aired > 0 ? anime.episodes_aired : 12);

    // Генерация кнопок-ссылок для серий в плеер VLC
    let episodesHtml = '';
    for (let i = 1; i <= totalEpisodes; i++) {
        const vlcLink = generateVlcLink(anime.id, i);
        episodesHtml += `
            <a href="${vlcLink}" class="episode-btn" title="Открыть серию ${i} в VLC">
                Серия ${i}
            </a>
        `;
    }

    modalContent.innerHTML = `
        <img class="modal-poster" src="${posterUrl}" alt="${anime.russian || anime.name}">
        <div class="modal-info-details">
            <h2 class="modal-title">${anime.russian || anime.name}</h2>
            <div class="modal-stats-line">
                <span class="rating">★ ${anime.score || '—.—'}</span>
                <span>Статус: <b>${status}</b></span>
                <span>Эпизоды: <b>${anime.episodes_aired}/${anime.episodes || '?'}</b></span>
            </div>
            <div><b>Жанры:</b> ${genres}</div>
            <div class="modal-description">${anime.description_html ? stripHtml(anime.description_html) : 'Описание отсутствует.'}</div>
            
            <div class="episodes-section">
                <h3>Смотреть через VLC</h3>
                <div class="episodes-grid">
                    ${episodesHtml}
                </div>
            </div>
        </div>
    `;
}

// Закрытие модального окна
function closeModal() {
    modal.classList.remove('show');
    document.body.style.overflow = '';
}

// Вспомогательная функция очистки описания от HTML-тегов Шикимори
function stripHtml(html) {
    let tmp = document.createElement("DIV");
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || "";
}
