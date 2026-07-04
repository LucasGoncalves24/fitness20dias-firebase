// ============================================================
//  Projeto 20 Dias — Firebase Edition — app.js
// ============================================================
import { initializeApp }         from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js';
import { getDatabase, ref, get, set, update, onValue, push }
from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-database.js';

// ── Config Firebase ─────────────────────────────────────────
const firebaseConfig = {
	apiKey:            'AIzaSyAauRNgfhrmFuFTQz9fXa2ctzNzLln4WSE',
	authDomain:        'projetoteste-7b819.firebaseapp.com',
	databaseURL:       'https://projetoteste-7b819-default-rtdb.firebaseio.com',
	projectId:         'projetoteste-7b819',
	storageBucket:     'projetoteste-7b819.firebasestorage.app',
	messagingSenderId: '669424297618',
	appId:             '1:669424297618:web:b402e873d9efdfd64ca84b',
	measurementId:     'G-RHRVMYT0WT',
};

const app = initializeApp(firebaseConfig);
const db  = getDatabase(app);

// ── Constantes ───────────────────────────────────────────────
const GOALS = { protein: 160, carbs: 210, fat: 80, calories: 2200, water: 3000, sleep: 7.5 };
const ROOT  = '0'; // índice raiz no seu Realtime DB

// ── Refs Firebase ────────────────────────────────────────────
const fbRef = {
	users:           () => ref(db, `${ROOT}/users`),
	programDays:     () => ref(db, `${ROOT}/program_days`),
	exercises:       () => ref(db, `${ROOT}/exercises`),
	dailyLogs:       () => ref(db, `${ROOT}/daily_logs`),
	exerciseChecks:  () => ref(db, `${ROOT}/exercise_checks`),
	macroLogs:       () => ref(db, `${ROOT}/macro_logs`),
};

// ── Estado da aplicação ─────────────────────────────────────
let STATE = {
	userId:     null,
	userName:   '',
	startDate:  null,
	dayNumber:  1,
	logId:      null,
	programDay: null,
	exercises:  [],
	checks:     {},
	macros:     { protein: 0, carbs: 0, fat: 0, creatine: false },
	water:      0,
	sleep:      0,
	sleepRating:-1,
	allLogs:    [],
	allMacros:  [],
	allChecks:  [],
};

// ── Dados em memória (carregados uma vez) ────────────────────
let DB = {
	programDays: [],
	exercises:   [],
	dailyLogs:   [],
	macroLogs:   [],
	exerciseChecks: [],
	users:       [],
};

// ============================================================
//  BOOT
// ============================================================
window.addEventListener('load', async () => {
	// Verifica sessão local
	const saved = localStorage.getItem('fitness20_user');
	if (saved) {
		try {
			const u = JSON.parse(saved);
			STATE.userId    = u.id;
			STATE.userName  = u.name;
			STATE.startDate = u.start_date;
			await loadAllData();
			showApp();
			} catch {
			localStorage.removeItem('fitness20_user');
			showAuth();
		}
		} else {
		showAuth();
	}
});

// ============================================================
//  AUTH
// ============================================================
window.authTab = (tab) => {
	document.getElementById('tab-login').style.display    = tab === 'login'    ? '' : 'none';
	document.getElementById('tab-register').style.display = tab === 'register' ? '' : 'none';
	document.querySelectorAll('.auth-tab').forEach((b,i) =>
	b.classList.toggle('active', (i===0 && tab==='login') || (i===1 && tab==='register')));
};

window.doLogin = async () => {
	const email = document.getElementById('inp-email').value.trim();
	const pass  = document.getElementById('inp-pass').value;
	const errEl = document.getElementById('auth-error');
	errEl.style.display = 'none';
	
	if (!email || !pass) { showErr('Preencha e-mail e senha.'); return; }
	
	try {
		const snap = await get(fbRef.users());
		const users = snap.val() || [];
		const user = users.find(u => u && u.email === email);
		
		if (!user) { showErr('E-mail não encontrado.'); return; }
		
		// Verificação simples (hash bcrypt não pode ser verificado no front — usamos email+data de início como "autenticação leve")
		// Para produção real, usar Firebase Auth. Aqui validamos só o e-mail pois o hash é bcrypt do servidor.
		STATE.userId    = String(user.id);
		STATE.userName  = user.name;
		STATE.startDate = user.start_date;
		
		localStorage.setItem('fitness20_user', JSON.stringify({ id: user.id, name: user.name, start_date: user.start_date }));
		
		await loadAllData();
		showApp();
		} catch (e) {
		showErr('Erro ao conectar. Verifique sua conexão.');
		console.error(e);
	}
	
	function showErr(msg) { errEl.textContent = msg; errEl.style.display = ''; }
};

window.doRegister = async () => {
	const name   = document.getElementById('reg-name').value.trim();
	const email  = document.getElementById('reg-email').value.trim();
	const age    = parseInt(document.getElementById('reg-age').value) || 29;
	const height = parseInt(document.getElementById('reg-height').value) || 175;
	const weight = parseFloat(document.getElementById('reg-weight').value) || 78;
	const errEl  = document.getElementById('auth-error');
	errEl.style.display = 'none';
	
	if (!name || !email) { errEl.textContent = 'Preencha nome e e-mail.'; errEl.style.display=''; return; }
	
	try {
		const snap  = await get(fbRef.users());
		const users = snap.val() || [];
		if (users.find(u => u && u.email === email)) {
			errEl.textContent = 'E-mail já cadastrado.'; errEl.style.display=''; return;
		}
		
		const newId    = String(users.filter(Boolean).length + 1);
		const today    = new Date().toISOString().split('T')[0];
		const newUser  = { id: newId, name, email, password: 'firebase_auth', age, height_cm: height, weight_kg: weight, start_date: today, created_at: new Date().toISOString() };
		
		// Salva no Firebase
		const updatedUsers = [...(users.filter(Boolean)), newUser];
		await set(fbRef.users(), updatedUsers);
		
		STATE.userId    = newId;
		STATE.userName  = name;
		STATE.startDate = today;
		
		localStorage.setItem('fitness20_user', JSON.stringify({ id: newId, name, start_date: today }));
		
		await loadAllData();
		showApp();
		} catch (e) {
		errEl.textContent = 'Erro ao criar conta.'; errEl.style.display='';
		console.error(e);
	}
};

window.doLogout = () => {
	localStorage.removeItem('fitness20_user');
	location.reload();
};

// ============================================================
//  LOAD DATA
// ============================================================
async function loadAllData() {
	document.getElementById('loading-screen').style.display = 'flex';
	
	// Carrega tudo de uma vez
	const [pdSnap, exSnap, dlSnap, mlSnap, ecSnap] = await Promise.all([
		get(fbRef.programDays()),
		get(fbRef.exercises()),
		get(fbRef.dailyLogs()),
		get(fbRef.macroLogs()),
		get(fbRef.exerciseChecks()),
	]);
	
	DB.programDays     = (pdSnap.val() || []).filter(Boolean);
	DB.exercises       = (exSnap.val() || []).filter(Boolean);
	DB.dailyLogs       = (dlSnap.val() || []).filter(Boolean);
	DB.macroLogs       = (mlSnap.val() || []).filter(Boolean);
	DB.exerciseChecks  = (ecSnap.val() || []).filter(Boolean);
	
	// Calcula o dia do programa
	STATE.dayNumber = calcDayNumber(STATE.startDate);
	
	// Pega o program_day
	STATE.programDay = DB.programDays.find(d => String(d.day_number) === String(STATE.dayNumber)) || DB.programDays[0];
	
	// Exercícios do dia
	STATE.exercises = DB.exercises.filter(e => String(e.program_day_id) === String(STATE.programDay?.id)).sort((a,b) => a.sort_order - b.sort_order);
	
	// Log de hoje
	const today    = new Date().toISOString().split('T')[0];
	let log        = DB.dailyLogs.find(l => String(l.user_id) === String(STATE.userId) && l.log_date === today);
	
	if (!log) {
		log = await createDailyLog(today);
	}
	STATE.logId = String(log.id);
	
	// Macros de hoje
	const macro = DB.macroLogs.find(m => String(m.daily_log_id) === String(STATE.logId));
	STATE.macros = {
		protein:  parseInt(macro?.protein_g)  || 0,
		carbs:    parseInt(macro?.carbs_g)    || 0,
		fat:      parseInt(macro?.fat_g)      || 0,
		creatine: macro?.creatine == '1' || macro?.creatine === true,
	};
	
	// Água e sono
	STATE.water = parseInt(log.water_ml) || 0;
	STATE.sleep = parseFloat(log.sleep_hours) || 0;
	
	// Checks do dia
	const todayChecks = DB.exerciseChecks.filter(c => String(c.daily_log_id) === String(STATE.logId));
	STATE.checks = {};
	todayChecks.forEach(c => { STATE.checks[String(c.exercise_id)] = c.checked == '1' || c.checked === true; });
	
	document.getElementById('loading-screen').style.display = 'none';
}

async function createDailyLog(today) {
	const newId = String(DB.dailyLogs.length + 1);
	const log   = { id: newId, user_id: String(STATE.userId), log_date: today, day_number: String(STATE.dayNumber), water_ml: '0', sleep_hours: '0.0', weight_kg: null, note: null, completed_at: null };
	
	DB.dailyLogs.push(log);
	await set(fbRef.dailyLogs(), DB.dailyLogs);
	
	// Cria macro_log zerado
	const macroId = String(DB.macroLogs.length + 1);
	const macro   = { id: macroId, daily_log_id: newId, protein_g: '0', carbs_g: '0', fat_g: '0', calories: '0', creatine: '0' };
	DB.macroLogs.push(macro);
	await set(fbRef.macroLogs(), DB.macroLogs);
	
	return log;
}

function calcDayNumber(startDate) {
	const start = new Date(startDate + 'T00:00:00');
	const today = new Date(); today.setHours(0,0,0,0);
	const diff  = Math.floor((today - start) / 86400000) + 1;
	return Math.min(Math.max(diff, 1), 20);
}

// ============================================================
//  RENDER APP
// ============================================================
function showAuth() {
	document.getElementById('loading-screen').style.display = 'none';
	document.getElementById('auth-page').style.display     = '';
	document.getElementById('app-page').style.display      = 'none';
}

function showApp() {
	document.getElementById('auth-page').style.display = 'none';
	document.getElementById('app-page').style.display  = '';
	renderSidebar();
	renderDashboard();
	showSection('hoje');
}

function renderSidebar() {
	document.getElementById('sb-mark').textContent     = 'DIA ' + STATE.dayNumber + ' DE 20';
	document.getElementById('sb-avatar').textContent   = STATE.userName.charAt(0).toUpperCase();
	document.getElementById('sb-username').textContent = STATE.userName;
	
	// Timeline sidebar
	let html = '';
	for (let d = 1; d <= 20; d++) {
		const isT = d === STATE.dayNumber;
		const isP = d < STATE.dayNumber;
		html += `<div class="nav-item" style="padding:6px 12px;font-size:12px;cursor:default;${isT?'color:var(--accent)':isP?'opacity:.45':''}">
		<span style="width:6px;height:6px;border-radius:50%;display:inline-block;margin-right:6px;flex-shrink:0;background:${isT?'var(--accent)':isP?'var(--accent-glow)':'var(--border-strong)'}"></span>
		Dia ${d}${isT?' ← hoje':isP?' ✓':''}
		</div>`;
	}
	document.getElementById('sb-days').innerHTML = html;
}

function renderDashboard() {
	const pd = STATE.programDay;
	const typeMap = { treino:'Treino', cardio:'Cardio', circuito:'Circuito', descanso:'Descanso Ativo' };
	
	// ── HOJE ──
	document.getElementById('hl-day').innerHTML    = `DIA <span>${STATE.dayNumber}</span> — ${pd?.focus || ''}`;
	document.getElementById('hl-badge').className  = 'meta-badge badge-' + (pd?.type || 'treino');
	document.getElementById('hl-badge').textContent= typeMap[pd?.type] || 'Treino';
	document.getElementById('hl-dur').textContent  = pd?.duration_min > 0 ? pd.duration_min + ' min · Semana ' + pd.week : 'Descanso · Semana ' + pd?.week;
	
	// Timeline
	let tlHtml = '';
	for (let d = 1; d <= 20; d++) {
		const cls = d === STATE.dayNumber ? 'today' : d < STATE.dayNumber ? 'past done' : '';
		tlHtml += `<div class="tl-day ${cls}"><span class="tl-num">${d}</span><div class="tl-dot"></div></div>`;
	}
	document.getElementById('timeline').innerHTML = tlHtml;
	
	// ── TREINO ──
	document.getElementById('tr-headline').innerHTML  = `🏋️ TREINO — <span>${pd?.focus || ''}</span>`;
	document.getElementById('tr-badge').className     = 'meta-badge badge-' + (pd?.type || 'treino');
	document.getElementById('tr-badge').textContent   = typeMap[pd?.type] || 'Treino';
	document.getElementById('tr-dur').textContent     = pd?.duration_min > 0 ? pd.duration_min + ' min estimados · Semana ' + pd?.week : 'Semana ' + pd?.week;
	
	renderExercises();
	updateAllStats();
}

// ── Exercícios ───────────────────────────────────────────────
function renderExercises() {
	const list = document.getElementById('exercise-list');
	if (!STATE.exercises.length) {
		list.innerHTML = `<div style="text-align:center;padding:3rem 0;color:var(--text-muted)">
		<div style="font-size:3rem;margin-bottom:1rem">🌙</div>
		<div style="font-size:16px;font-weight:500;color:var(--text-secondary)">Dia de descanso ativo</div>
		<div style="font-size:13px;margin-top:6px">Caminhada + alongamento. O músculo cresce no descanso.</div>
		</div>`;
		return;
	}
	
	list.innerHTML = STATE.exercises.map(ex => {
		const done = STATE.checks[String(ex.id)];
		return `<div class="exercise-item ${done?'done':''}" id="ex-${ex.id}" onclick="toggleEx('${ex.id}')">
		<div class="ex-check"><span class="ex-check-icon">✓</span></div>
		<div class="ex-info">
        <div class="ex-name">${ex.name}</div>
        <div class="ex-meta">
		<span class="ex-tag sets">${ex.sets}× séries</span>
		<span class="ex-tag reps">${ex.reps}</span>
		${parseInt(ex.rest_seconds) > 0 ? `<span class="ex-tag rest">${ex.rest_seconds}s descanso</span>` : ''}
        </div>
        ${ex.technique_tip ? `<div class="ex-tip">💡 ${ex.technique_tip}</div>` : ''}
		</div>
		</div>`;
	}).join('');
}

window.toggleEx = async (exId) => {
	const isDone = !STATE.checks[exId];
	STATE.checks[exId] = isDone;
	
	const el = document.getElementById('ex-' + exId);
	if (el) el.classList.toggle('done', isDone);
	
	updateAllStats();
	if (isDone) ripple(el);
	
	try {
		// Atualiza ou cria check no Firebase
		const existing = DB.exerciseChecks.find(c => String(c.daily_log_id) === String(STATE.logId) && String(c.exercise_id) === String(exId));
		
		if (existing) {
			existing.checked    = isDone ? '1' : '0';
			existing.checked_at = isDone ? new Date().toISOString().replace('T',' ').slice(0,19) : null;
			} else {
			const newId = String(DB.exerciseChecks.length + 1);
			DB.exerciseChecks.push({ id: newId, daily_log_id: String(STATE.logId), exercise_id: String(exId), checked: isDone ? '1' : '0', checked_at: isDone ? new Date().toISOString().replace('T',' ').slice(0,19) : null });
		}
		
		await set(fbRef.exerciseChecks(), DB.exerciseChecks);
		
		if (isDone && STATE.exercises.every(e => STATE.checks[String(e.id)])) {
			toast('🎉 Treino do dia concluído!', 'success');
		}
	} catch { toast('Erro ao salvar check.', 'error'); }
};

// ── Macros ───────────────────────────────────────────────────
window.adjustMacro = (type, delta) => {
	const limits = { protein:[0,400], carbs:[0,600], fat:[0,200] };
	const [mn, mx] = limits[type];
	STATE.macros[type] = Math.max(mn, Math.min(mx, STATE.macros[type] + delta));
	updateMacroUI();
};

window.toggleCreatine = () => {
	STATE.macros.creatine = !STATE.macros.creatine;
	document.querySelectorAll('.creatine-toggle').forEach(el => el.classList.toggle('on', STATE.macros.creatine));
};

function updateMacroUI() {
	const { protein, carbs, fat } = STATE.macros;
	const cals = protein * 4 + carbs * 4 + fat * 9;
	
	// Displays com botões +/−
	se('disp-protein', protein); se('disp-carbs', carbs); se('disp-fat', fat);
	se('total-cals', cals);
	se('sum-prot', protein + 'g'); se('sum-carbs', carbs + 'g'); se('sum-fat', fat + 'g');
	
	// Barras
	setBar('bar-protein', protein, GOALS.protein);
	setBar('bar-carbs',   carbs,   GOALS.carbs);
	setBar('bar-fat',     fat,     GOALS.fat);
	setBar('bar-cals',    cals,    GOALS.calories);
	
	// % labels
	se('pct-protein', pct(protein, GOALS.protein) + '%');
	se('pct-carbs',   pct(carbs,   GOALS.carbs)   + '%');
	se('pct-fat',     pct(fat,     GOALS.fat)      + '%');
	
	// Total cals color
	const tc = document.getElementById('total-cals');
	if (tc) tc.style.color = cals > GOALS.calories ? 'var(--danger)' : 'inherit';
	
	// stat tile
	se('stat-cals', cals);
	
	// Overview
	setBar('ov-prot-bar', protein, GOALS.protein);
	se('ov-prot-label', protein + 'g / ' + GOALS.protein + 'g');
}

window.saveMacros = async () => {
	const btn = document.getElementById('btn-save-macros');
	btn.disabled = true; btn.innerHTML = '⏳ Salvando...';
	
	try {
		const { protein, carbs, fat, creatine } = STATE.macros;
		const cals = protein * 4 + carbs * 4 + fat * 9;
		
		const idx = DB.macroLogs.findIndex(m => String(m.daily_log_id) === String(STATE.logId));
		const macroData = { id: idx >= 0 ? DB.macroLogs[idx].id : String(DB.macroLogs.length + 1),
			daily_log_id: String(STATE.logId), protein_g: String(protein), carbs_g: String(carbs),
		fat_g: String(fat), calories: String(cals), creatine: creatine ? '1' : '0' };
		
		if (idx >= 0) DB.macroLogs[idx] = macroData;
		else DB.macroLogs.push(macroData);
		
		await set(fbRef.macroLogs(), DB.macroLogs);
		toast('✅ Nutrição salva!', 'success');
	} catch { toast('Erro ao salvar.', 'error'); }
	finally { btn.disabled = false; btn.innerHTML = '💾 Salvar nutrição do dia'; }
};

// ── Água ─────────────────────────────────────────────────────
window.adjustWater = (delta) => {
	STATE.water = Math.max(0, Math.min(6000, STATE.water + delta));
	updateWaterUI();
};

window.addWater = (ml) => adjustWater(ml);

function updateWaterUI() {
	const p = pct(STATE.water, GOALS.water);
	se('water-big', STATE.water); se('stat-water', STATE.water);
	setBar('water-fill', STATE.water, GOALS.water);
	se('water-pct', p + '%');
	se('ov-water-label', STATE.water + 'ml / ' + GOALS.water + 'ml');
	setBar('ov-water-bar', STATE.water, GOALS.water);
	renderCups();
}

function renderCups() {
	const wrap = document.getElementById('water-cups');
	if (!wrap) return;
	const total  = Math.ceil(GOALS.water / 250);
	const filled = Math.floor(STATE.water / 250);
	wrap.innerHTML = '';
	for (let i = 0; i < total; i++) {
		const d = document.createElement('div');
		d.className = 'water-cup' + (i < filled ? ' filled' : '');
		d.title     = (i+1)*250 + 'ml';
		d.textContent = i < filled ? '💧' : '';
		d.onclick   = () => { STATE.water = (i+1)*250; updateWaterUI(); };
		wrap.appendChild(d);
	}
}

// ── Sono ─────────────────────────────────────────────────────
window.adjustSleep = (delta) => {
	STATE.sleep = Math.max(0, Math.min(12, parseFloat((STATE.sleep + delta).toFixed(1))));
	updateSleepUI();
};

window.setSleepRating = (idx) => {
	STATE.sleepRating = idx;
	document.querySelectorAll('.sleep-btn').forEach((b, i) => b.classList.toggle('active', i === idx));
};

function updateSleepUI() {
	const p = pct(STATE.sleep, GOALS.sleep);
	se('sleep-big', STATE.sleep); se('stat-sleep', STATE.sleep);
	setBar('sleep-fill', STATE.sleep, GOALS.sleep);
	se('sleep-pct', p + '%');
	se('ov-sleep-label', STATE.sleep + 'h / ' + GOALS.sleep + 'h');
	setBar('ov-sleep-bar', STATE.sleep, GOALS.sleep);
}

window.saveWaterSleep = async () => {
	const btn = document.getElementById('btn-save-ws');
	btn.disabled = true; btn.innerHTML = '⏳ Salvando...';
	
	try {
		const idx = DB.dailyLogs.findIndex(l => String(l.id) === String(STATE.logId));
		if (idx >= 0) {
			DB.dailyLogs[idx].water_ml    = String(STATE.water);
			DB.dailyLogs[idx].sleep_hours = String(STATE.sleep);
			await set(fbRef.dailyLogs(), DB.dailyLogs);
		}
		toast('✅ Dados salvos!', 'success');
	} catch { toast('Erro ao salvar.', 'error'); }
	finally { btn.disabled = false; btn.innerHTML = '💾 Salvar hidratação & sono'; }
};

// ── Histórico ─────────────────────────────────────────────────
function renderHistory() {
	const body = document.getElementById('history-body');
	const logs = DB.dailyLogs.filter(l => String(l.user_id) === String(STATE.userId))
    .sort((a,b) => b.log_date.localeCompare(a.log_date));
	
	if (!logs.length) {
		body.innerHTML = `<p style="color:var(--text-muted);text-align:center;padding:2rem">Nenhum registro ainda.</p>`;
		return;
	}
	
	let html = `<div style="overflow-x:auto"><table class="history-table"><thead><tr>
    <th>Data</th><th>Dia</th><th>Proteína</th><th>Carbs</th><th>Gordura</th><th>Kcal</th><th>Água</th><th>Sono</th><th>Creatina</th>
	</tr></thead><tbody>`;
	
	logs.forEach(log => {
		const macro = DB.macroLogs.find(m => String(m.daily_log_id) === String(log.id));
		const p = parseInt(macro?.protein_g)||0, c = parseInt(macro?.carbs_g)||0, f = parseInt(macro?.fat_g)||0;
		const cals = p*4 + c*4 + f*9;
		const cre  = macro?.creatine=='1' ? '<span style="color:var(--accent);font-weight:700">✓</span>' : '<span style="color:var(--text-muted)">—</span>';
		const date = new Date(log.log_date+'T00:00:00').toLocaleDateString('pt-BR');
		html += `<tr>
		<td>${date}</td>
		<td><span style="color:var(--accent);font-weight:600">Dia ${log.day_number}</span></td>
		<td style="color:var(--accent)">${p}g</td>
		<td style="color:var(--accent2)">${c}g</td>
		<td style="color:var(--warn)">${f}g</td>
		<td>${cals}Kcal</td>
		<td style="color:var(--accent2)">${log.water_ml||0}ml</td>
		<td style="color:var(--purple)">${log.sleep_hours||0}h</td>
		<td>${cre}</td>
		</tr>`;
	});
	
	html += '</tbody></table></div>';
	body.innerHTML = html;
}

// ── Stats globais ─────────────────────────────────────────────
function updateAllStats() {
	const total = STATE.exercises.length;
	const done  = Object.values(STATE.checks).filter(Boolean).length;
	const p     = pct(done, total || 1);
	se('stat-ex', done);
	setBar('ex-bar', done, total || 1);
	se('ex-label', done + ' / ' + total);
	setBar('ov-ex-bar', done, total || 1);
	se('ov-ex-label', done + ' / ' + total);
	updateMacroUI();
	updateWaterUI();
	updateSleepUI();
}

// ── Navegação ─────────────────────────────────────────────────
window.showSection = (name) => {
	document.querySelectorAll('.app-section').forEach(s => s.classList.remove('active'));
	document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
	const sec = document.getElementById('sec-' + name);
	if (sec) sec.classList.add('active');
	const btn = document.getElementById('nav-' + name);
	if (btn) btn.classList.add('active');
	document.querySelector('.main-content')?.scrollTo(0, 0);
	if (name === 'historico') renderHistory();
};

// ── Utilitários ───────────────────────────────────────────────
function pct(val, goal) { return Math.min(100, Math.round((val / (goal||1)) * 100)); }
function se(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }
function setBar(id, val, goal) { const el = document.getElementById(id); if (el) el.style.width = pct(val, goal) + '%'; }
function ripple(el) { if (!el) return; el.style.transform='scale(1.01)'; setTimeout(()=>el.style.transform='scale(1)',150); }

window.toast = (msg, type = 'success') => {
	const c = document.getElementById('toast-container');
	const el = document.createElement('div');
	el.className = 'toast ' + type;
	el.textContent = msg;
	c.appendChild(el);
	setTimeout(() => el.remove(), 3500);
};

window.refreshHistory = () => renderHistory();
