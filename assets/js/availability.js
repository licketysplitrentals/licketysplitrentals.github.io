const SHEET_ID = "1zIJVEAACvg2neEEeAtf6FZ6pa7UV_18mu0XMBYEec3M";

const MACHINES_URL = `https://opensheet.elk.sh/${SHEET_ID}/Machines`;
const AVAILABILITY_URL = `https://opensheet.elk.sh/${SHEET_ID}/Availability`;

const machineSelect = document.getElementById("machineSelect");
const scheduleBtn = document.getElementById("scheduleBtn");

const MINIMUM_DAY_BUFFER = 1;

let machines = [];
let blockedDates = [];
let calendar;
let availabilityData = [];

const today = new Date();

(function () {
      emailjs.init("fpP4H3VBJ7J0y6Oag");
})();

// Load both tabs
Promise.all([
  fetch(MACHINES_URL).then(r => r.json()),
  fetch(AVAILABILITY_URL).then(r => r.json())
]).then(([machinesData, availabilityData]) => {
  machines = machinesData;
  blockedDates = availabilityData;

  populateMachineSelector();
  initCalendar();

  // Wait for calendar render cycle
  requestAnimationFrame(() => {
    updateCalendar(machineSelect.value);
  });
});

function populateMachineSelector() {
  machineSelect.innerHTML = "";

  machines.forEach((m, index) => {
    const option = document.createElement("option");
    option.value = m.machine_id;
    option.textContent = m.machine_name;
    machineSelect.appendChild(option);

    // Explicitly select first machine
    if (index === 0) {
      machineSelect.value = m.machine_id;
    }
  });
}

function initCalendar() {
  // const today = new Date();
  // today.setHours(0, 0, 0, 0);

  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const endOfRange = new Date(startOfMonth);
  endOfRange.setMonth(endOfRange.getMonth() + 12);

  calendar = new FullCalendar.Calendar(
    document.getElementById("calendar"),
    {
      initialView: "dayGridMonth",
      // showNonCurrentDates: false,
      // fixedWeekCount: false,

      initialDate: startOfMonth,

      visibleRange: {
        start: startOfMonth,
        end: endOfRange
      },

      headerToolbar: {
          left: "prev,next today",
          center: "title",
          right: ""
      },
      height: "auto",
      selectable: false,

      dayCellDidMount(info) {
        const date = info.date;
        const isSunday = date.getDay() === 0;
        const isPast = date < today;

        // if (isSunday || isPast) {
        //   info.el.classList.add("fc-disabled-day");
        //   console.log("blocking");
        // }
      }
    }
  );

  calendar.render();
}


machineSelect.addEventListener("change", () => {
  updateCalendar(machineSelect.value);
});

function isDateBlocked(dateStr, ranges) {
  const date = new Date(dateStr);
  date.setHours(0, 0, 0, 0);

  return ranges.some(r =>
   (date >= r.start) && (date <= r.end)
  );
}

function isGracePeriod(date) {
  const endGrace = new Date(today + MINIMUM_DAY_BUFFER);
  let isGrace = false;
  for(
    const d = new Date(date);
    d <= endGrace;
    d.setDate(d.getDate() + 1)
  ){
    isGrace = true;
  }
  
  return isGrace;
}

function updateCalendar(machineId) {
  if (!machineId || !calendar) {
    return;
  }
  
  calendar.removeAllEvents();

  const machineBlockedRanges = blockedDates
    .filter(d => d.Machine === machineId)
    .map(d => ({
      start: new Date(d.StartDate),
      end: new Date(d.EndDate)
    }));

  // const today = new Date();
  // today.setHours(0, 0, 0, 0);

  // Explicit range: current month → +4 months
  const rangeStart = new Date();
  rangeStart.setHours(0, 0, 0, 0);
  rangeStart.setDate(1);

  const rangeEnd = new Date(rangeStart);
  rangeEnd.setMonth(rangeEnd.getMonth() + 4);
  rangeEnd.setDate(today.getDate());
  rangeEnd.setHours(12, 0, 0, 0);

  const events = [];

  for (
    let d = new Date(rangeStart);
    d < rangeEnd;
    d.setDate(d.getDate() + 1)
  ) {
    d.setHours(0, 0, 0, 0);
    const dateStr = d.toISOString().split("T")[0];
    const isSunday = d.getDay() === 0;
    const isPast = (d < today);
    const isBlocked = isDateBlocked(d, machineBlockedRanges);
    
    if (!isSunday && !isPast && !isBlocked && (d != today)) {
      events.push({
        start: dateStr,
        allDay: true,
        display: "background",
        backgroundColor: "#4bd84fff"
      });
    }
    else if (isBlocked) {
      events.push({
        start: dateStr,
        allDay: true,
        display: "background",
        backgroundColor: "rgb(216, 75, 75)"
      });
    }
  }

  calendar.addEventSource(events);

  // const machine = machines.find(m => m.machine_id === machineId);
  // scheduleBtn.href = machine.booking_url;
}

// Form submit handler
document.getElementById("requestForm").addEventListener("submit", function (e) {
  e.preventDefault();

  const machines = getSelectedMachines();
  const start = new Date(document.getElementById("startDate").value);
  const end = new Date(document.getElementById("endDate").value);

  if (start > end) {
    alert("End date must be on or after start date.");
    return;
  }

  if (hasConflict(machines, start, end)) {
    alert("One or more selected machines are unavailable for that date range.");
    return;
  }

  const templateParams = {
    first_name: document.getElementById("firstName").value,
    last_name: document.getElementById("lastName").value,
    email: document.getElementById("email").value,
    phone: document.getElementById("phone").value,
    machines: machines.join(", "),
    start_date: document.getElementById("startDate").value,
    end_date: document.getElementById("endDate").value,
    vanilla: document.getElementById("vanilla_bag").value,
    chocolate: document.getElementById("chocolate_bag").value
  };

  emailjs
    .send(
      "service_az2vhne",
      "template_4dtvfsi",
      templateParams
    )
    .then(() => {
      alert("Request sent successfully. You will receive an email of your request soon.");
      document.getElementById("requestForm").reset();
    })
    .catch(err => {
      console.error(err);
      alert("Failed to send email. Please try again.");
    });
});


function buildUnavailableEvents() {
  return availabilityData.map(row => ({
    start: row["Start Date"],
    end: addOneDay(row["End Date"]),
    display: "background",
    backgroundColor: "#FF0000FF"
  }));
}

function hasConflict(machines, start, end) {
  return blockedDates.some(row => {
    if (!machines.includes(row["Machine"])) return false;

    const blockStart = new Date(row["StartDate"]);
    const blockEnd = new Date(row["EndDate"]);
    return start <= blockEnd && end >= blockStart;
  });
}

function getSelectedMachines() {
  return Array.from(document.getElementById("machines").selectedOptions)
    .map(o => o.value);
}