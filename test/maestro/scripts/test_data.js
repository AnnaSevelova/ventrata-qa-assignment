// Generates the data for one purchase run and pre-computes every value the
// flows assert on, so YAML only has to compare against `output.td.*`.
//
// Ticket quantities are random within the business rules (1+ adult, max 20
// combined) unless pinned via env, e.g. `-e ADULTS=2 -e CHILDREN=1`, which
// is how a failing random run is reproduced. Invalid input fails right here
// instead of somewhere confusing later in the flow.

var MAX_TICKETS = 20;
var ADULT_PRICE_CENTS = 3000;
var CHILD_PRICE_CENTS = 1500;
var BOOKING_FEE_PERCENT = 10;
var FIRST_MADAME_HOUR = 10;
var LAST_MADAME_HOUR = 16;
var HOP_ON_GAP_HOURS = 2;

function randInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

// Reads an optional integer env value; null when not set.
function envInt(name, value) {
  if (typeof value === 'undefined' || value === '') return null;
  var n = Number(value);
  if (!Number.isInteger(n)) {
    throw new Error('[test-data] ' + name + ' must be an integer, got "' + value + '"');
  }
  return n;
}

function check(condition, message) {
  if (!condition) throw new Error('[test-data] ' + message);
}

function money(cents) {
  return (cents / 100).toFixed(2);
}

function slot(hour) {
  return (hour < 10 ? '0' : '') + hour + ':00';
}

var adults = envInt('ADULTS', typeof ADULTS !== 'undefined' ? ADULTS : undefined);
var children = envInt('CHILDREN', typeof CHILDREN !== 'undefined' ? CHILDREN : undefined);
var madameHour = envInt('MADAME_HOUR', typeof MADAME_HOUR !== 'undefined' ? MADAME_HOUR : undefined);

// Random part: draw the total first, then split it, so orders of every size
// are equally likely and children show up in most runs.
if (adults === null && children === null) {
  var total = randInt(1, MAX_TICKETS);
  adults = randInt(1, total);
  children = total - adults;
} else if (adults === null) {
  adults = randInt(1, Math.max(1, MAX_TICKETS - children));
} else if (children === null) {
  children = randInt(0, Math.max(0, MAX_TICKETS - adults));
}
if (madameHour === null) madameHour = randInt(FIRST_MADAME_HOUR, LAST_MADAME_HOUR);

check(adults >= 1, 'ADULTS must be at least 1 (a child needs an adult), got ' + adults);
check(children >= 0, 'CHILDREN must not be negative, got ' + children);
check(adults + children <= MAX_TICKETS,
  'ADULTS + CHILDREN must be at most ' + MAX_TICKETS + ', got ' + (adults + children));
check(madameHour >= FIRST_MADAME_HOUR && madameHour <= LAST_MADAME_HOUR,
  'MADAME_HOUR must be ' + FIRST_MADAME_HOUR + '-' + LAST_MADAME_HOUR + ', got ' + madameHour);

var hopOnHour = madameHour + HOP_ON_GAP_HOURS;

// Visit date: the 15th of next month. Always inside the 52-week booking
// window and never "today", so the live 15:00 same-day cutoff can't make the
// run time-of-day dependent.
var now = new Date();
var visit = new Date(now.getFullYear(), now.getMonth() + 1, 15);

var adultCents = adults * ADULT_PRICE_CENTS;
var childCents = children * CHILD_PRICE_CENTS;
var subtotalCents = adultCents + childCents;
var feeCents = (subtotalCents * BOOKING_FEE_PERCENT) / 100;
var totalCents = subtotalCents + feeCents;

output.td = {
  maxTickets: MAX_TICKETS,
  adults: adults,
  children: children,
  tickets: adults + children,
  visitDay: visit.getDate(),
  visitDate: visit.getDate() + '. ' + (visit.getMonth() + 1) + '. ' + visit.getFullYear(),
  madameSlot: slot(madameHour),
  madameSlotId: slot(madameHour).replace(':', '_'),
  // First slot that must NOT be offered for Hop-on (only 1 h after Madame).
  hopOnTooEarlySlotId: slot(madameHour + 1).replace(':', '_'),
  hopOnSlot: slot(hopOnHour),
  hopOnSlotId: slot(hopOnHour).replace(':', '_'),
  adultLine: money(adultCents),
  childLine: money(childCents),
  bookingFee: money(feeCents),
  total: money(totalCents),
  promoCode: 'MAESTROFREE',
};

// Literal values used in Maestro text selectors must be escaped as regexes.
function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
var literalFields = ['adultLine', 'childLine', 'bookingFee', 'total', 'visitDate'];
for (var i = 0; i < literalFields.length; i++) {
  var field = literalFields[i];
  output.td[field + 'Pattern'] = escapeRegex(output.td[field]);
}

console.log(
  '[test-data] adults=' + adults + ' children=' + children +
  ' madame=' + output.td.madameSlot + ' hopOn=' + output.td.hopOnSlot +
  ' visit=' + output.td.visitDate + ' expectedTotal=' + output.td.total + ' EUR'
);
