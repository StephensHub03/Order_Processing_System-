import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function OrderCalendar({ orders = [], errors = [], onSelectDate, selectedDate: controlledSelectedDate }) {
  // Extract all order dates and determine initial month/year
  const { orderDateMap, initialYear, initialMonth, defaultActiveDate } = useMemo(() => {
    const map = {};
    let latestDate = null;

    const processDate = (rawDate) => {
      if (!rawDate) return;
      const str = String(rawDate).slice(0, 10);
      if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
        map[str] = (map[str] || 0) + 1;
        if (!latestDate || str > latestDate) {
          latestDate = str;
        }
      }
    };

    orders.forEach(o => processDate(o.created_at || o.date));
    errors.forEach(e => processDate(e.created_at));

    // Fallback if no dates exist: September 2026
    let year = 2026;
    let month = 8; // September (0-indexed)
    let active = '2026-09-26';

    if (latestDate) {
      const parts = latestDate.split('-');
      year = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10) - 1;
      active = latestDate;
    }

    return {
      orderDateMap: map,
      initialYear: year,
      initialMonth: month,
      defaultActiveDate: active
    };
  }, [orders, errors]);

  const [currentYear, setCurrentYear] = useState(initialYear);
  const [currentMonth, setCurrentMonth] = useState(initialMonth);
  const [internalSelectedDate, setInternalSelectedDate] = useState(defaultActiveDate);

  const selectedDate = controlledSelectedDate !== undefined ? controlledSelectedDate : internalSelectedDate;

  // Navigate months
  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(y => y - 1);
    } else {
      setCurrentMonth(m => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(y => y + 1);
    } else {
      setCurrentMonth(m => m + 1);
    }
  };

  // Build grid of days
  const calendarDays = useMemo(() => {
    const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();
    const daysInCurrentMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(currentYear, currentMonth, 0).getDate();

    const days = [];

    // Preceding month days
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i;
      const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
      const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
      const dateKey = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      days.push({
        dayNum,
        dateKey,
        isCurrentMonth: false,
        count: orderDateMap[dateKey] || 0
      });
    }

    // Current month days
    for (let dayNum = 1; dayNum <= daysInCurrentMonth; dayNum++) {
      const dateKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      days.push({
        dayNum,
        dateKey,
        isCurrentMonth: true,
        count: orderDateMap[dateKey] || 0
      });
    }

    // Following month days to complete 35 or 42 cells
    const totalCells = days.length <= 35 ? 35 : 42;
    const remaining = totalCells - days.length;
    for (let dayNum = 1; dayNum <= remaining; dayNum++) {
      const nextMonth = currentMonth === 11 ? 0 : currentMonth + 1;
      const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear;
      const dateKey = `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      days.push({
        dayNum,
        dateKey,
        isCurrentMonth: false,
        count: orderDateMap[dateKey] || 0
      });
    }

    return days;
  }, [currentYear, currentMonth, orderDateMap]);

  const handleDayClick = (day) => {
    setInternalSelectedDate(day.dateKey);
    if (onSelectDate) {
      onSelectDate(day.dateKey, day.count);
    }
  };

  return (
    <article className="order-calendar-card" aria-label="Order activity calendar">
      {/* Month & Navigation Header */}
      <header className="calendar-card-header">
        <h2 className="calendar-month-title">
          {MONTH_NAMES[currentMonth]} {currentYear}
        </h2>
        <div className="calendar-nav-buttons">
          <button
            type="button"
            className="calendar-nav-btn"
            onClick={handlePrevMonth}
            aria-label="Previous Month"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            className="calendar-nav-btn"
            onClick={handleNextMonth}
            aria-label="Next Month"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </header>

      {/* Weekday initial headers */}
      <div className="calendar-weekdays-row" aria-hidden="true">
        {WEEKDAYS.map(day => (
          <span key={day} className="calendar-weekday-label">
            {day}
          </span>
        ))}
      </div>

      {/* Days grid */}
      <div className="calendar-days-grid" role="grid" aria-label={`Days of ${MONTH_NAMES[currentMonth]} ${currentYear}`}>
        {calendarDays.map((day, idx) => {
          const isSelected = selectedDate === day.dateKey;
          const hasOrders = day.count > 0;

          // Determine indicator dot color: High (>=4), Medium (2-3), Low (1)
          let heatTier = null;
          if (hasOrders) {
            if (day.count >= 4) heatTier = 'high';
            else if (day.count >= 2) heatTier = 'medium';
            else heatTier = 'low';
          }

          return (
            <button
              key={`${day.dateKey}-${idx}`}
              type="button"
              className={`calendar-day-cell ${day.isCurrentMonth ? 'in-month' : 'out-month'} ${isSelected ? 'selected' : ''} ${hasOrders ? 'has-orders' : ''}`}
              onClick={() => handleDayClick(day)}
              aria-label={`${day.dateKey}: ${day.count} orders`}
              aria-selected={isSelected}
            >
              <span className="calendar-day-number">{day.dayNum}</span>

              {/* Indicator dot if day has orders and is not the glowing selected circle */}
              {hasOrders && !isSelected && (
                <span className={`calendar-heat-dot ${heatTier}`} />
              )}
            </button>
          );
        })}
      </div>

      {/* Legend Footer */}
      <footer className="calendar-legend-footer">
        <div className="calendar-legend-item">
          <span className="legend-dot green" />
          <span>High Orders</span>
        </div>
        <div className="calendar-legend-item">
          <span className="legend-dot yellow" />
          <span>Medium</span>
        </div>
        <div className="calendar-legend-item">
          <span className="legend-dot grey" />
          <span>Low</span>
        </div>
      </footer>
    </article>
  );
}
