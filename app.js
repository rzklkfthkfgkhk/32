(function() {
    'use strict';

    // DOM
    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.getElementById('searchBtn');
    const grid = document.getElementById('grid');
    const count = document.getElementById('count');
    const logo = document.getElementById('logoLink');
    
    const player = document.getElementById('player');
    const playerTitle = document.getElementById('playerTitle');
    const playerFrame = document.getElementById('playerFrame');
    const closePlayer = document.getElementById('closePlayer');
    const episodeSelect = document.getElementById('episodeSelect');
    const playerStatus = document.getElementById('playerStatus');
    const sourceInfo = document.getElementById('sourceInfo');

    let currentResults = [];
    let currentAnime = null;
    let isLoading = false;

    // ===== GraphQL =====
    const QUERY = `
        query ($search: String) {
            Page(page: 1, perPage: 30) {
                media(search: $search, type: ANIME, sort: POPULARITY_DESC) {
                    id
                    idMal
                    title { romaji english native }
                    coverImage { large extraLarge }
                    format
                    episodes
                    status
                    averageScore
                    genres
                }
            }
        }
    `;

    // ===== SEARCH =====
    async function search(query) {
        if (!query?.trim()) {
            showEmpty('Введите название аниме');
            updateCount(0);
            return;
        }

        if (isLoading) return;
        isLoading = true;

        showLoading();
        updateCount('⏳');

        try {
            const res = await fetch('https://graphql.anilist.co', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query: QUERY,
                    variables: { search: query.trim() }
                })
            });

            if (!res.ok) throw new Error(`HTTP ${res.status}`);

            const json = await res.json();
            if (json.errors) throw new Error('Ошибка GraphQL');

            const media = json?.data?.Page?.media || [];
            currentResults = media;

            if (!media.length) {
                showEmpty('Ничего не найдено 😢');
                updateCount(0);
                return;
            }

            renderCards(media);
            updateCount(media.length);

        } catch (err) {
            console.error(err);
            showEmpty(`Ошибка: ${err.message}`);
            updateCount('⚠️');
        } finally {
            isLoading = false;
        }
    }

    // ===== RENDER =====
    function renderCards(list) {
        let html = '';
        for (const anime of list) {
            const title = anime.title?.romaji || anime.title?.english || 'Без названия';
            const cover = anime.coverImage?.extraLarge || anime.coverImage?.large || '';
            const genres = (anime.genres || []).slice(0, 2).join(' · ');
            const score = anime.averageScore ? Math.round(anime.averageScore / 10) : '—';
            const episodes = anime.episodes || '?';
            const status = anime.status || 'UNKNOWN';
            
            const dotClass = status === 'RELEASING' ? 'green' : status === 'FINISHED' ? 'blue' : 'gray';
            const statusLabel = status === 'RELEASING' ? 'Выходит' : status === 'FINISHED' ? 'Завершён' : 'Скоро';

            html += `
                <div class="card" data-id="${anime.id}">
                    <img src="${cover}" alt="${title}" loading="lazy" 
                         onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22300%22 height=%22450%22%3E%3Crect fill=%22%23161b22%22 width=%22300%22 height=%22450%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 font-size=%2220%22 fill=%22%238b949e%22 text-anchor=%22middle%22 dominant-baseline=%22central%22%3ENo Image%3C/text%3E%3C/svg%3E'" />
                    <div class="card-body">
                        <h3>${escapeHtml(title)}</h3>
                        ${genres ? `<div style="font-size:12px;color:#8b949e;margin:4px 0;">${escapeHtml(genres)}</div>` : ''}
                        <div class="tags">
                            <span>${anime.format || 'TV'}</span>
                            <span class="score"><i class="fas fa-star"></i> ${score}</span>
                            <span>${episodes} эп.</span>
                        </div>
                        <div class="status">
                            <span class="dot ${dotClass}"></span>
                            ${statusLabel}
                        </div>
                    </div>
                </div>
            `;
        }
        grid.innerHTML = html;

        document.querySelectorAll('.card').forEach(el => {
            el.addEventListener('click', function() {
                const id = parseInt(this.dataset.id);
                const anime = currentResults.find(a => a.id === id);
                if (anime) openPlayer(anime);
            });
        });
    }

    // ===== PLAYER =====
    function openPlayer(anime) {
        currentAnime = anime;
        const title = anime.title?.romaji || anime.title?.english || 'Аниме';
        
        player.classList.remove('hidden');
        playerTitle.textContent = title;
        
        // Настраиваем серии
        const total = anime.episodes || 12;
        episodeSelect.innerHTML = '';
        for (let i = 1; i <= Math.min(total, 50); i++) {
            const opt = document.createElement('option');
            opt.value = i;
            opt.textContent = `Серия ${i}`;
            episodeSelect.appendChild(opt);
        }
        
        // Загружаем первую серию
        loadEpisode(anime.id, 1);
        
        setTimeout(() => {
            player.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
    }

    // ===== LOAD EPISODE (АВТОМАТИЧЕСКИ) =====
    function loadEpisode(id, episode) {
        // РАБОЧИЕ ИСТОЧНИКИ
        const sources = [
            `https://animeflix.live/embed/${id}?ep=${episode}`,
            `https://gogoanime.llc/embed/${id}?ep=${episode}`,
            `https://aniwatch.to/embed/${id}?ep=${episode}`,
            `https://zoro.to/embed/${id}?ep=${episode}`,
            `https://allanime.to/embed/${id}?ep=${episode}`,
            `https://animepahe.com/embed/${id}?ep=${episode}`,
            `https://9anime.to/embed/${id}?ep=${episode}`
        ];

        setStatus('Загрузка видео...', 'info');
        sourceInfo.innerHTML = `<i class="fas fa-sync-alt fa-spin"></i> Пробуем источники...`;
        
        let tried = 0;
        let loaded = false;

        function trySource(index) {
            if (index >= sources.length || loaded) {
                if (!loaded) {
                    setStatus('Не удалось загрузить. Попробуйте другую серию.', 'error');
                    sourceInfo.innerHTML = `<i class="fas fa-exclamation-circle"></i> Все источники недоступны`;
                }
                return;
            }

            const url = sources[index];
            playerFrame.src = url;
            sourceInfo.innerHTML = `<i class="fas fa-sync-alt fa-spin"></i> Источник ${index + 1}/${sources.length}`;

            // Ждём загрузку
            playerFrame.onload = function() {
                loaded = true;
                setStatus(`Серия ${episode} загружена!`, 'success');
                sourceInfo.innerHTML = `<i class="fas fa-check-circle" style="color:#2ea043;"></i> Видео загружено`;
            };

            // Если через 5 секунд не загрузилось - пробуем следующий
            setTimeout(() => {
                if (!loaded) {
                    trySource(index + 1);
                }
            }, 5000);
        }

        trySource(0);
    }

    // ===== CHANGE EPISODE =====
    function changeEpisode() {
        if (currentAnime) {
            const ep = parseInt(episodeSelect.value);
            loadEpisode(currentAnime.id, ep);
        }
    }

    // ===== STATUS =====
    function setStatus(msg, type) {
        const icon = type === 'success' ? 'fa-check-circle' : 
                     type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle';
        playerStatus.className = `player-status ${type || 'info'}`;
        playerStatus.innerHTML = `<i class="fas ${icon}"></i> ${msg}`;
    }

    // ===== CLOSE =====
    function closePlayerFn() {
        player.classList.add('hidden');
        playerFrame.src = '';
        currentAnime = null;
    }

    // ===== GO HOME =====
    function goHome() {
        closePlayerFn();
        showEmpty('Найдите любимое аниме');
        updateCount(0);
        document.querySelector('.header').scrollIntoView({ behavior: 'smooth' });
    }

    // ===== UI HELPERS =====
    function showEmpty(msg) {
        grid.innerHTML = `
            <div class="empty">
                <i class="fas fa-search"></i>
                <h3>${msg}</h3>
                <p>Введите название в поиск</p>
            </div>
        `;
    }

    function showLoading() {
        grid.innerHTML = `
            <div class="loading">
                <i class="fas fa-spinner"></i>
                <p>Загрузка...</p>
            </div>
        `;
    }

    function updateCount(val) {
        const span = count.querySelector('span') || count;
        if (typeof val === 'number') {
            span.textContent = `${val} аниме`;
        } else {
            span.textContent = val;
        }
    }

    function escapeHtml(text) {
        const d = document.createElement('div');
        d.textContent = text;
        return d.innerHTML;
    }

    // ===== EVENTS =====
    searchBtn.addEventListener('click', () => {
        search(searchInput.value.trim());
    });

    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') searchBtn.click();
    });

    closePlayer.addEventListener('click', closePlayerFn);
    episodeSelect.addEventListener('change', changeEpisode);

    logo.addEventListener('click', (e) => {
        e.preventDefault();
        goHome();
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !player.classList.contains('hidden')) {
            closePlayerFn();
        }
    });

    // Global
    window.goHome = goHome;
    window.closePlayer = closePlayerFn;

    // ===== INIT =====
    showEmpty('Найдите любимое аниме');
    updateCount(0);

    setTimeout(() => {
        search('one piece');
    }, 300);

})();
