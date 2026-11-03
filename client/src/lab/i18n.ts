// Incident Lab texts in English, Russian and Armenian. Technical identifiers (tool names,
// commands, terminal output, release ids) stay as they are in every language.

import { useCallback, useEffect, useState } from "react";
import type { IncidentStatus } from "../../../contracts/events";

export type Lang = "en" | "ru" | "hy";
export const LANGS: { id: Lang; label: string; name: string }[] = [
  { id: "en", label: "EN", name: "English" },
  { id: "ru", label: "RU", name: "Русский" },
  { id: "hy", label: "ՀՅ", name: "Հայերեն" },
];

const KEY = "lab-lang";

function initialLang(): Lang {
  const fromUrl = new URLSearchParams(location.search).get("lang");
  if (fromUrl === "en" || fromUrl === "ru" || fromUrl === "hy") return fromUrl;
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === "en" || saved === "ru" || saved === "hy") return saved;
  } catch { /* storage blocked: fall through */ }
  const nav = navigator.language.toLowerCase();
  return nav.startsWith("hy") ? "hy" : nav.startsWith("ru") ? "ru" : "en";
}

export function useLabLang(): [Lang, (l: Lang) => void] {
  const [lang, setLang] = useState<Lang>(initialLang);
  useEffect(() => {
    const prev = document.documentElement.lang;
    document.documentElement.lang = lang;
    return () => { document.documentElement.lang = prev; };
  }, [lang]);
  const choose = useCallback((l: Lang) => {
    setLang(l);
    try { localStorage.setItem(KEY, l); } catch { /* not persisted */ }
  }, []);
  return [lang, choose];
}

const fill = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k: string) => String(v[k] ?? ""));

type Svc = { nom: string; gen: string };

const en = {
  eyebrow: "Incident Lab",
  live: "live",
  connecting: "connecting",
  replaysOnly: "replays only",
  title: "Break a real server. Watch an AI engineer fix it.",
  leadBefore: "Pick what goes wrong. A real server in AWS breaks, monitoring raises the alarm, and an AI on-call engineer investigates and repairs it with a small set of safe tools, step by step, in front of you. Open ",
  leadAfter: " in another tab to watch the site itself go down and come back.",
  labServer: "Lab server",
  asleep: "Asleep (saving money)",
  healthy: "Healthy",
  down: "Having problems",
  responseTime: "Response time",
  cpu: "CPU",
  disk: "Disk",
  aiEngineer: "AI engineer",
  onDuty: "On duty",
  onCall: "On a call",
  offline: "Offline",
  breaksLeft: "Live breaks left today",
  whatBreaks: "What should break?",
  chooseAria: "Choose what breaks",
  busyHint: "An incident is running. Watch it in the console.",
  surpriseTitle: "Surprise me",
  surpriseBlurb: "A random failure. Neither you nor the AI knows which one until the end.",
  emptyTitle: "Nothing is broken yet.",
  emptyBody: "Pick a failure, or replay a real past incident below.",
  liveIncident: "Live incident",
  replay: "Replay",
  replayDone: "Replay · finished",
  surpriseUnknown: "Surprise: unknown failure",
  readyNext: "The lab is ready for the next visitor.",
  waitingSignal: "Waiting for the first signal…",
  alert: "Alert",
  alertText: "Monitoring: the site is in trouble.",
  fixed: "Fixed",
  notFixed: "Not fixed",
  outcomeStats: "{s} s · {n} steps",
  scripted: "Scripted engineer",
  tokens: "{n} tokens",
  labReset: "lab reset",
  resetFailed: "lab reset failed",
  postmortem: "Postmortem",
  aiNotesLang: "The AI writes its notes in the language of the visitor who started the incident.",
  pastIncidents: "Real past incidents",
  pastAria: "Past incidents",
  fixedIn: "fixed in {s} s",
  notFixedIn: "not fixed",
  replayBtn: "Replay",
  running: "running",
  language: "Language",
  err: {
    cooldown: "You already broke it recently. Try again in {m} min, or watch a replay below.",
    queue_full: "Several people are breaking it right now. Try again in a couple of minutes.",
    daily_limit: "Today's live breaks are used up. The replays below show real past incidents.",
    agent_offline: "The AI engineer is offline right now. The replays below show real past incidents.",
    unreachable: "The lab is unreachable right now.",
    generic: "Something went wrong. Please try again.",
  } as Record<string, string>,
  stages: ["Wake", "Break", "Detect", "Investigate", "Fix", "Verify", "Done"],
  status: {
    queued: "Waiting in line…",
    waking: "The lab server is asleep. Waking it up (about a minute)…",
    breaking: "Breaking the server…",
    detecting: "Monitoring notices something is wrong…",
    investigating: "The AI on-call engineer is investigating…",
    fixing: "Applying a fix…",
    verifying: "Independent check: is it really fixed?",
    resolved: "Fixed.",
    failed: "Not fixed this time.",
    resetting: "Resetting the lab for the next visitor…",
  } as Record<IncidentStatus, string>,
  scenarios: {
    "nginx-stopped": ["Stop the web server", "The program that answers visitors suddenly stops."],
    "disk-full": ["Fill the disk", "A runaway file eats all free space, and the site can't save anything."],
    "bad-release": ["Ship a broken version", "A new version with a bug goes live and visitors see a blank page."],
    "bad-config": ["Break the settings", "A typo in the web server's settings stops it from starting."],
    "cpu-hog": ["Overload the CPU", "A greedy program takes all the processing power and the site crawls."],
  } as Record<string, [string, string]>,
  svc: { nginx: { nom: "the web server", gen: "the web server's" }, app: { nom: "the application", gen: "the application's" } } as Record<string, Svc>,
  tools: {
    check_health: "Opening the website like a visitor would.",
    get_metrics: "Checking the server's vital signs.",
    service_status: "Is {nom} running?",
    read_logs: "Reading {gen} log.",
    disk_usage: "Checking whether the disk is full.",
    list_processes: "Looking for a program that eats all the power.",
    list_releases: "Looking at recent versions of the website.",
    nginx_config_test: "Checking the web server's settings for mistakes.",
    recent_changes: "Asking: what changed recently?",
    restart_service: "Restarting {nom}.",
    rollback: "Going back to the previous working version.",
    delete_file: "Removing the junk file that filled the disk.",
    kill_process: "Stopping the runaway program.",
    restore_config: "Putting back the last working settings.",
    resolve: "Declaring the incident fixed.",
    unknown: "Trying a tool that does not exist.",
  } as Record<string, string>,
};

type Dict = typeof en;

const ru: Dict = {
  eyebrow: "Incident Lab",
  live: "в эфире",
  connecting: "подключение",
  replaysOnly: "только повторы",
  title: "Сломайте настоящий сервер. Посмотрите, как его чинит AI-инженер.",
  leadBefore: "Выберите, что сломается. Настоящий сервер в AWS выходит из строя, мониторинг поднимает тревогу, а дежурный AI-инженер шаг за шагом находит причину и устраняет её небольшим набором безопасных инструментов — прямо у вас на глазах. Откройте ",
  leadAfter: " в соседней вкладке, чтобы увидеть, как сам сайт падает и снова поднимается.",
  labServer: "Сервер лаборатории",
  asleep: "Спит (экономим деньги)",
  healthy: "Исправен",
  down: "Есть проблемы",
  responseTime: "Время ответа",
  cpu: "Процессор",
  disk: "Диск",
  aiEngineer: "AI-инженер",
  onDuty: "На дежурстве",
  onCall: "На вызове",
  offline: "Не в сети",
  breaksLeft: "Поломок на сегодня",
  whatBreaks: "Что сломать?",
  chooseAria: "Выберите поломку",
  busyHint: "Идёт инцидент — следите за ним в консоли.",
  surpriseTitle: "Удивите меня",
  surpriseBlurb: "Случайная поломка. Ни вы, ни AI не знаете, какая именно, — до самого конца.",
  emptyTitle: "Пока ничего не сломано.",
  emptyBody: "Выберите поломку или посмотрите повтор настоящего инцидента ниже.",
  liveIncident: "Инцидент в эфире",
  replay: "Повтор",
  replayDone: "Повтор · завершён",
  surpriseUnknown: "Сюрприз: неизвестная поломка",
  readyNext: "Лаборатория готова к следующему посетителю.",
  waitingSignal: "Ждём первого сигнала…",
  alert: "Тревога",
  alertText: "Мониторинг: у сайта проблемы.",
  fixed: "Починено",
  notFixed: "Не починено",
  outcomeStats: "{s} с · шагов: {n}",
  scripted: "Скриптовый инженер",
  tokens: "токенов: {n}",
  labReset: "лаборатория сброшена",
  resetFailed: "сброс лаборатории не удался",
  postmortem: "Разбор инцидента",
  aiNotesLang: "AI пишет заметки на языке посетителя, который запустил инцидент.",
  pastIncidents: "Настоящие прошлые инциденты",
  pastAria: "Прошлые инциденты",
  fixedIn: "починено за {s} с",
  notFixedIn: "не починено",
  replayBtn: "Повтор",
  running: "выполняется",
  language: "Язык",
  err: {
    cooldown: "Вы недавно уже ломали сервер. Попробуйте снова через {m} мин или посмотрите повтор ниже.",
    queue_full: "Сейчас сервер ломают сразу несколько человек. Попробуйте через пару минут.",
    daily_limit: "Живые поломки на сегодня закончились. Ниже — повторы настоящих инцидентов.",
    agent_offline: "AI-инженер сейчас не в сети. Ниже — повторы настоящих инцидентов.",
    unreachable: "Лаборатория сейчас недоступна.",
    generic: "Что-то пошло не так. Попробуйте ещё раз.",
  },
  stages: ["Пробуждение", "Поломка", "Обнаружение", "Расследование", "Починка", "Проверка", "Готово"],
  status: {
    queued: "Ждём своей очереди…",
    waking: "Сервер лаборатории спит. Будим его (около минуты)…",
    breaking: "Ломаем сервер…",
    detecting: "Мониторинг замечает, что что-то не так…",
    investigating: "Дежурный AI-инженер расследует…",
    fixing: "Применяем исправление…",
    verifying: "Независимая проверка: действительно ли починено?",
    resolved: "Починено.",
    failed: "На этот раз починить не удалось.",
    resetting: "Готовим лабораторию к следующему посетителю…",
  },
  scenarios: {
    "nginx-stopped": ["Остановить веб-сервер", "Программа, которая отвечает посетителям, внезапно останавливается."],
    "disk-full": ["Заполнить диск", "Разросшийся файл съедает всё свободное место, и сайт больше ничего не может сохранить."],
    "bad-release": ["Выкатить сломанную версию", "Новая версия с ошибкой уходит в работу, и посетители видят пустую страницу."],
    "bad-config": ["Сломать настройки", "Опечатка в настройках веб-сервера не даёт ему запуститься."],
    "cpu-hog": ["Перегрузить процессор", "Прожорливая программа забирает всю вычислительную мощность, и сайт еле работает."],
  },
  svc: { nginx: { nom: "веб-сервер", gen: "веб-сервера" }, app: { nom: "приложение", gen: "приложения" } },
  tools: {
    check_health: "Открываю сайт так, как это сделал бы посетитель.",
    get_metrics: "Проверяю жизненные показатели сервера.",
    service_status: "Работает ли {nom}?",
    read_logs: "Читаю журнал {gen}.",
    disk_usage: "Проверяю, не заполнен ли диск.",
    list_processes: "Ищу программу, которая забирает всю мощность.",
    list_releases: "Смотрю последние версии сайта.",
    nginx_config_test: "Проверяю настройки веб-сервера на ошибки.",
    recent_changes: "Выясняю: что недавно менялось?",
    restart_service: "Перезапускаю {nom}.",
    rollback: "Возвращаю предыдущую рабочую версию.",
    delete_file: "Удаляю мусорный файл, который заполнил диск.",
    kill_process: "Останавливаю вышедшую из-под контроля программу.",
    restore_config: "Возвращаю последние рабочие настройки.",
    resolve: "Объявляю инцидент решённым.",
    unknown: "Пробую несуществующий инструмент.",
  },
};

const hy: Dict = {
  eyebrow: "Incident Lab",
  live: "ուղիղ եթեր",
  connecting: "միացում",
  replaysOnly: "միայն կրկնություններ",
  title: "Կոտրեք իրական սերվերը։ Տեսեք, թե ինչպես է AI ինժեները այն վերանորոգում։",
  leadBefore: "Ընտրեք, թե ինչը պետք է փչանա։ AWS-ում աշխատող իրական սերվերը խափանվում է, մոնիթորինգը ահազանգ է տալիս, իսկ հերթապահ AI ինժեները քայլ առ քայլ գտնում է պատճառը և վերացնում այն անվտանգ գործիքների փոքր հավաքածուով՝ հենց ձեր աչքի առաջ։ Բացեք ",
  leadAfter: " կայքը հարևան ներդիրում՝ տեսնելու, թե ինչպես է այն ընկնում և նորից աշխատում։",
  labServer: "Լաբորատոր սերվեր",
  asleep: "Քնած է (խնայում ենք գումար)",
  healthy: "Աշխատում է",
  down: "Խնդիրներ կան",
  responseTime: "Արձագանքման ժամանակ",
  cpu: "Պրոցեսոր",
  disk: "Սկավառակ",
  aiEngineer: "AI ինժեներ",
  onDuty: "Հերթապահում է",
  onCall: "Զբաղված է միջադեպով",
  offline: "Անցանց է",
  breaksLeft: "Այսօր մնացած խափանումներ",
  whatBreaks: "Ի՞նչը կոտրենք",
  chooseAria: "Ընտրեք խափանումը",
  busyHint: "Միջադեպն ընթացքի մեջ է․ հետևեք վահանակում։",
  surpriseTitle: "Զարմացրեք ինձ",
  surpriseBlurb: "Պատահական խափանում։ Մինչև վերջ ո՛չ դուք, ո՛չ էլ AI-ը չգիտեք, թե որն է։",
  emptyTitle: "Դեռ ոչինչ փչացած չէ։",
  emptyBody: "Ընտրեք խափանում կամ դիտեք իրական միջադեպի կրկնությունը ստորև։",
  liveIncident: "Ուղիղ միջադեպ",
  replay: "Կրկնություն",
  replayDone: "Կրկնություն · ավարտված",
  surpriseUnknown: "Անակնկալ․ անհայտ խափանում",
  readyNext: "Լաբորատորիան պատրաստ է հաջորդ այցելուի համար։",
  waitingSignal: "Սպասում ենք առաջին ազդանշանին…",
  alert: "Ահազանգ",
  alertText: "Մոնիթորինգ․ կայքը խնդիրներ ունի։",
  fixed: "Վերանորոգված է",
  notFixed: "Չվերանորոգվեց",
  outcomeStats: "{s} վ · {n} քայլ",
  scripted: "Սցենարային ինժեներ",
  tokens: "{n} թոքեն",
  labReset: "լաբորատորիան վերակայված է",
  resetFailed: "լաբորատորիայի վերակայումը ձախողվեց",
  postmortem: "Միջադեպի վերլուծություն",
  aiNotesLang: "AI-ը նշումները գրում է միջադեպը սկսած այցելուի լեզվով։",
  pastIncidents: "Իրական անցյալ միջադեպեր",
  pastAria: "Անցյալ միջադեպեր",
  fixedIn: "վերանորոգվեց {s} վայրկյանում",
  notFixedIn: "չվերանորոգվեց",
  replayBtn: "Դիտել",
  running: "ընթացքում է",
  language: "Լեզու",
  err: {
    cooldown: "Դուք վերջերս արդեն կոտրել եք սերվերը։ Փորձեք կրկին {m} րոպեից կամ դիտեք կրկնությունը ստորև։",
    queue_full: "Այս պահին մի քանի հոգի են սերվերը կոտրում։ Փորձեք մի քանի րոպեից։",
    daily_limit: "Այսօրվա ուղիղ խափանումները սպառվել են։ Ստորև՝ իրական միջադեպերի կրկնություններ։",
    agent_offline: "AI ինժեները այս պահին անցանց է։ Ստորև՝ իրական միջադեպերի կրկնություններ։",
    unreachable: "Լաբորատորիան այս պահին անհասանելի է։",
    generic: "Ինչ-որ բան սխալ ընթացավ։ Խնդրում ենք կրկին փորձել։",
  },
  stages: ["Արթնացում", "Խափանում", "Հայտնաբերում", "Ախտորոշում", "Վերանորոգում", "Ստուգում", "Ավարտ"],
  status: {
    queued: "Սպասում ենք հերթին…",
    waking: "Լաբորատոր սերվերը քնած է։ Արթնացնում ենք (մոտ մեկ րոպե)…",
    breaking: "Կոտրում ենք սերվերը…",
    detecting: "Մոնիթորինգը նկատում է, որ ինչ-որ բան այն չէ…",
    investigating: "Հերթապահ AI ինժեները պարզում է պատճառը…",
    fixing: "Կիրառում ենք ուղղումը…",
    verifying: "Անկախ ստուգում․ իսկապե՞ս վերանորոգված է։",
    resolved: "Վերանորոգված է։",
    failed: "Այս անգամ վերանորոգել չհաջողվեց։",
    resetting: "Լաբորատորիան պատրաստում ենք հաջորդ այցելուի համար…",
  },
  scenarios: {
    "nginx-stopped": ["Կանգնեցնել վեբ սերվերը", "Այցելուներին պատասխանող ծրագիրը հանկարծ կանգ է առնում։"],
    "disk-full": ["Լցնել սկավառակը", "Անվերահսկելի աճող ֆայլը զբաղեցնում է ողջ ազատ տեղը, և կայքն այլևս ոչինչ չի կարող պահպանել։"],
    "bad-release": ["Թողարկել խափանված տարբերակ", "Սխալով նոր տարբերակը հրապարակվում է, և այցելուները դատարկ էջ են տեսնում։"],
    "bad-config": ["Փչացնել կարգավորումները", "Վեբ սերվերի կարգավորումներում տառասխալը թույլ չի տալիս այն գործարկել։"],
    "cpu-hog": ["Գերբեռնել պրոցեսորը", "Ագահ ծրագիրը խլում է ողջ հաշվողական հզորությունը, և կայքը հազիվ է աշխատում։"],
  },
  svc: { nginx: { nom: "վեբ սերվերը", gen: "վեբ սերվերի" }, app: { nom: "հավելվածը", gen: "հավելվածի" } },
  tools: {
    check_health: "Բացում եմ կայքը այնպես, ինչպես այցելուն կբացեր։",
    get_metrics: "Ստուգում եմ սերվերի կենսական ցուցանիշները։",
    service_status: "Ստուգում եմ՝ աշխատո՞ւմ է արդյոք {nom}։",
    read_logs: "Կարդում եմ {gen} մատյանը։",
    disk_usage: "Ստուգում եմ՝ արդյոք սկավառակը լցված չէ։",
    list_processes: "Փնտրում եմ ծրագիր, որը խլում է ողջ հզորությունը։",
    list_releases: "Դիտում եմ կայքի վերջին տարբերակները։",
    nginx_config_test: "Ստուգում եմ վեբ սերվերի կարգավորումները սխալների համար։",
    recent_changes: "Պարզում եմ՝ ի՞նչ է փոխվել վերջերս։",
    restart_service: "Վերագործարկում եմ {nom}։",
    rollback: "Վերադառնում եմ նախորդ աշխատող տարբերակին։",
    delete_file: "Ջնջում եմ ավելորդ ֆայլը, որը լցրել էր սկավառակը։",
    kill_process: "Կանգնեցնում եմ անվերահսկելի ծրագիրը։",
    restore_config: "Վերականգնում եմ վերջին աշխատող կարգավորումները։",
    resolve: "Հայտարարում եմ միջադեպը լուծված։",
    unknown: "Փորձում եմ գոյություն չունեցող գործիք։",
  },
};

const DICTS: Record<Lang, Dict> = { en, ru, hy };

export function texts(lang: Lang) {
  const d = DICTS[lang];
  return {
    ...d,
    fill,
    scenario: (id: string | null, fallback: { title?: string; blurb?: string } = {}) => {
      const s = id ? d.scenarios[id] : undefined;
      return { title: s?.[0] ?? fallback.title ?? id ?? "", blurb: s?.[1] ?? fallback.blurb ?? "" };
    },
    /** Plain-language line for a tool call, in the viewer's language (tool names stay English). */
    explain: (tool: string, args: Record<string, unknown>) => {
      const line = d.tools[tool] ?? d.tools.unknown!;
      const svc = d.svc[String(args.service ?? "")] ?? d.svc.nginx!;
      return fill(line, { nom: svc.nom, gen: svc.gen });
    },
  };
}

export type Texts = ReturnType<typeof texts>;
