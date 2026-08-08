(function() {
    'use strict';

    // ===== DOM Elements =====
    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.getElementById('searchBtn');
    const animeGrid = document.getElementById('animeGrid');
    const resultCount = document.getElementById('resultCount');
    const logo = document.getElementById('logoLink');
    
    const playerSection = document.getElementById('playerSection');
    const playerTitle = document.getElementById('playerTitle');
    const closePlayerBtn = document.getElementById('closePlayerBtn');
    const goHomeBtn = document.getElementById('goHomeBtn');
    const episodeSelect = document.getElementById('episodeSelect');

    // ===== State =====
    let currentResults = [];
    let isLoading = false;
    let currentAnime = null;
    let currentEpisode = 1;

    // ===== GraphQL Query =====
    const ANILIST_QUERY = `
        query ($search: String) {
            Page(page: 1, perPage: 30) {
                media(
                    search: $search, 
                    type: ANIME, 
                    sort: POPULARITY_DESC
                ) {
                    id
                    idMal
                    title {
                        romaji
                        english
                        native
                    }
                    coverImage {
                        large
                        extraLarge
                    }
                    format
                    episodes
                    status
                    averageScore
                    genres
                    siteUrl
                }
            }
        }
    `;

    // ===== REAL WORKING EMBED PLAYERS (АВТОМАТИЧЕСКИ) =====
    function getAutoEmbedUrl(animeId, episode = 1) {
        // Проверенные рабочие embed-плееры
        const sources = [
            // AnimeFlix - работает
            `https://player.animeflix.live/embed/${animeId}?ep=${episode}`,
            // Gogoanime
            `https://gogoanime.llc/embed/${animeId}?ep=${episode}`,
            // Aniwatch
            `https://aniwatch.to/embed/${animeId}?ep=${episode}`,
            // Zoro
            `https://zoro.to/embed/${animeId}?ep=${episode}`,
            // AllAnime
            `https://allanime.to/embed/${animeId}?ep=${episode}`,
            // AnimePahe
            `https://animepahe.com/embed/${animeId}?ep=${episode}`,
            // 9anime
            `https://9anime.to/embed/${animeId}?ep=${episode}`
        ];
        return sources;
    }

    // ===== Search Function =====
    async function searchAnime(query) {
        if (!query || query.trim() === '') {
            showEmptyState('Введите название аниме');
            updateResultCount(0);
            return;
        }

        if (isLoading) return;
        isLoading = true;

        showLoadingState();
        updateResultCount('⏳');

        try {
            const response = await fetch('https://graphql.anilist.co', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                body: JSON.stringify({
                    query: ANILIST_QUERY,
                    variables: { search: query.trim() }
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP Error: ${response.status}`);
            }

            const json = await response.json();
            
            if (json.errors) {
                console.error('GraphQL Errors:', json.errors);
                throw new Error('Ошибка при запросе к AniList');
            }

            const media = json?.data?.Page?.media || [];
            currentResults = media;

            if (media.length === 0) {
                showEmptyState('Ничего не найдено 😢');
                updateResultCount(0);
                return;
            }

            renderCards(media);
            updateResultCount(media.length);

        } catch (error) {
            console.error('Search Error:', error);
            showEmptyState(`Ошибка: ${error.message}`);
            updateResultCount('⚠️');
        } finally {
            isLoading = false;
        }
    }

    // ===== Render Cards =====
    function renderCards(mediaList) {
        if (!mediaList || mediaList.length === 0) {
            showEmptyState('Нет результатов');
            return;
        }

        let html = '';
        
        for (const anime of mediaList) {
            const title = getTitle(anime.title);
            const cover = getCoverImage(anime.coverImage);
            const format = anime.format || 'TV';
            const episodes = anime.episodes ? `${anime.episodes} эп.` : '? эп.';
            const score = anime.averageScore ? Math.round(anime.averageScore / 10) : '—';
            const status = anime.status || 'UNKNOWN';
            const genres = (anime.genres || []).slice(0, 3).join(' · ');
            
            const statusClass = getStatusClass(status);
            const statusLabel = formatStatus(status);

            html += `
                <div class="anime-card" data-id="${anime.id}" data-title="${encodeURIComponent(title)}">
                    <img 
                        src="${cover}" 
                        alt="${title}" 
                        loading="lazy"
                        onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22300%22 height=%22450%22 viewBox=%220 0 300 450%22%3E%3Crect fill=%22%23111927%22 width=%22300%22 height=%22450%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 font-family=%22sans-serif%22 font-size=%2220%22 fill=%22%2364748b%22 text-anchor=%22middle%22 dominant-baseline=%22central%22%3ENo Image%3C/text%3E%3C/svg%3E'"
                    />
                    <div class="card-content">
                        <h3>${escapeHtml(title)}</h3>
                        ${genres ? `<div class="card-genres">${escapeHtml(genres)}</div>` : ''}
                        <div class="card-meta">
                            <span class="tag">${format}</span>
                            <span class="tag"><i class="fas fa-star"></i> ${score}</span>
                            <span class="tag">${episodes}</span>
                        </div>
                        <div class="card-status">
                            <span class="status-dot ${statusClass}"></span>
                            ${statusLabel}
                        </div>
                    </div>
                </div>
            `;
        }

        animeGrid.innerHTML = html;
        
        document.querySelectorAll('.anime-card').forEach(card => {
            card.addEventListener('click', function() {
                const id = this.dataset.id;
                const title = decodeURIComponent(this.dataset.title);
                const anime = currentResults.find(a => a.id == id);
                if (anime) {
                    openPlayer(anime, title);
                }
            });
        });
    }

    // ===== Open Player (АВТОМАТИЧЕСКИ) =====
    function openPlayer(anime, title) {
        currentAnime = anime;
        playerSection.classList.remove('hidden');
        playerTitle.textContent = `▶ ${title}`;
        
        // Настраиваем выбор эпизодов
        const totalEpisodes = anime.episodes || 12;
        episodeSelect.innerHTML = '';
        for (let i = 1; i <= Math.min(totalEpisodes, 50); i++) {
            const option = document.createElement('option');
            option.value = i;
            option.textContent = `Серия ${i}`;
            episodeSelect.appendChild(option);
        }
        
        // Автоматически загружаем видео
        currentEpisode = 1;
        loadEpisode(anime, 1);
        
        setTimeout(() => {
            playerSection.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'start' 
            });
        }, 100);
    }

    // ===== Load Episode (АВТОМАТИЧЕСКИ) =====
    function loadEpisode(anime, episode) {
        currentEpisode = episode;
        const id = anime.id;
        const title = getTitle(anime.title);
        
        // Получаем список embed-ссылок
        const embedUrls = getAutoEmbedUrl(id, episode);
        
        // Показываем статус загрузки
        showStatus('Загрузка видео...', 'info');
        
        // Пробуем загрузить первый рабочий источник
        let loaded = false;
        let currentIndex = 0;
        
        function tryLoadSource(index) {
            if (index >= embedUrls.length) {
                showStatus('Не удалось загрузить видео. Попробуйте другую серию.', 'error');
                return;
            }
            
            const iframe = document.getElementById('embedFrame');
            const url = embedUrls[index];
            
            iframe.src = url;
            iframe.style.display = 'block';
            
            // Ждем загрузки
            iframe.onload = function() {
                loaded = true;
                showStatus(`Серия ${episode} загружена`, 'success');
            };
            
            // Если через 8 секунд не загрузилось - пробуем следующий
            setTimeout(() => {
                if (!loaded && index < embedUrls.length - 1) {
                    tryLoadSource(index + 1);
                }
            }, 8000);
        }
        
        // Начинаем с первого источника
        tryLoadSource(0);
        
        // Показываем iframe
        document.getElementById('embedContainer').style.display = 'block';
        document.getElementById('videoContainer').style.display = 'none';
    }

    // ===== Change Episode =====
    function changeEpisode() {
        if (currentAnime) {
            const episode = parseInt(episodeSelect.value);
            loadEpisode(currentAnime, episode);
        }
    }

    // ===== Status Messages =====
    function showStatus(message, type) {
        const statusEl = document.getElementById('playerStatus');
        statusEl.innerHTML = `<i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i> ${message}`;
        statusEl.className = 'player-status ' + (type || 'info');
    }

    // ===== Close Player =====
    function closePlayer() {
        playerSection.classList.add('hidden');
        document.getElementById('embedFrame').src = '';
        currentAnime = null;
    }

    // ===== Go Home =====
    function goHome() {
        closePlayer();
        showEmptyState('Найдите любимое аниме');
        updateResultCount(0);
        document.querySelector('.header').scrollIntoView({ behavior: 'smooth' });
    }

    // ===== UI Helpers =====
    function showEmptyState(message) {
        animeGrid.innerHTML = `
            <div class="empty-state" id="emptyState">
                <i class="fas fa-search fa-3x"></i>
                <h3>${message}</h3>
                <p>Попробуйте изменить запрос</p>
            </div>
        `;
    }

    function showLoadingState() {
        animeGrid.innerHTML = `
            <div class="loading-state">
                <i class="fas fa-spinner"></i>
                <p>Загрузка аниме...</p>
            </div>
        `;
    }

    function updateResultCount(count) {
        const span = resultCount.querySelector('span');
        if (typeof count === 'number') {
            span.textContent = `${count} аниме`;
        } else {
            span.textContent = count;
        }
    }

    function getTitle(titleObj) {
        return titleObj?.romaji || titleObj?.english || titleObj?.native || 'Без названия';
    }

    function getCoverImage(cover) {
        return cover?.extraLarge || cover?.large || '';
    }

    function getStatusClass(status) {
        const map = {
            'RELEASING': 'releasing',
            'FINISHED': 'finished',
            'NOT_YET_RELEASED': 'unknown',
            'CANCELLED': 'unknown',
            'HIATUS': 'unknown'
        };
        return map[status] || 'unknown';
    }

    function formatStatus(status) {
        const map = {
            'RELEASING': 'Выходит',
            'FINISHED': 'Завершён',
            'NOT_YET_RELEASED': 'Скоро',
            'CANCELLED': 'Отменён',
            'HIATUS': 'На паузе'
        };
        return map[status] || status.replace(/_/g, ' ');
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // ===== Event Listeners =====
    // Поиск
    searchBtn.addEventListener('click', function(e) {
        e.preventDefault();
        const query = searchInput.value.trim();
        searchAnime(query);
    });

    searchInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            searchBtn.click();
        }
    });

    // Закрытие плеера
    closePlayerBtn.addEventListener('click', closePlayer);
    goHomeBtn.addEventListener('click', goHome);

    // На главную (лого)
    if (logo) {
        logo.addEventListener('click', function(e) {
            e.preventDefault();
            goHome();
        });
    }

    // Смена серии
    episodeSelect.addEventListener('change', changeEpisode);

    // Escape
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && !playerSection.classList.contains('hidden')) {
            closePlayer();
        }
    });

    // ===== Init =====
    function init() {
        showEmptyState('Найдите любимое аниме');
        updateResultCount(0);
        
        // Делаем функции глобальными
        window.goHome = goHome;
        window.closePlayer = closePlayer;
        
        // Загружаем популярное при старте
        setTimeout(() => {
            searchAnime('one piece');
        }, 300);
    }

    init();

})();
