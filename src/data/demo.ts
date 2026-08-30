import type { WorkOrder } from '../types';

export const demoOrders: WorkOrder[] = [
  {
    ticket_id: 'WO-2026-1048',
    title: 'HVAC issue — Cedar Lodge',
    description: 'Guest reported that the AC is blowing warm air in Room 12. Thermostat is set to 68°F but the room temperature is 74°F. Please inspect and resolve as soon as possible.',
    category: 'HVAC / Climate',
    location: 'Cedar Lodge · Guest Room 12',
    priority: 'High',
    status: 'In Progress',
    name: 'Olivia Bennett',
    email: 'olivia@example.com',
    phone: '(828) 555-0188',
    technician: 'Marcus Hill',
    supervisor: 'Tiffany',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    tech_note: 'Checked condenser and airflow. Replacing failed capacitor.',
    photos: []
  },
  {
    ticket_id: 'WO-2026-1047',
    title: 'Plumbing leak — Lakeview Cabin 3',
    description: 'Slow leak beneath vanity sink. Water has been isolated and towels placed.',
    category: 'Plumbing',
    location: 'Lakeview Cabin 3',
    priority: 'High',
    status: 'Open',
    name: 'Sofia Martinez',
    technician: null,
    timestamp: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    photos: []
  },
  {
    ticket_id: 'WO-2026-1046',
    title: 'Wi-Fi outage — Main Hall',
    description: 'Guest Wi-Fi is unavailable near the east meeting rooms. Staff network remains online.',
    category: 'IT / Technology',
    location: 'Main Hall',
    priority: 'Medium',
    status: 'Open',
    name: 'Ethan Park',
    technician: 'Eric',
    timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    photos: []
  },
  {
    ticket_id: 'WO-2026-1045',
    title: 'Lighting repair — Meditation Center',
    description: 'Two ceiling fixtures are flickering near the north entrance.',
    category: 'Electrical',
    location: 'Meditation Center',
    priority: 'Low',
    status: 'In Progress',
    name: 'Jade Kim',
    technician: 'Ethan',
    timestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    photos: []
  },
  {
    ticket_id: 'WO-2026-1044',
    title: 'Door closer — Main Entrance',
    description: 'Main entrance door is closing too quickly and needs adjustment.',
    category: 'General Maintenance',
    location: 'Main Lodge',
    priority: 'Low',
    status: 'Pending Tiffany',
    name: 'Marcus Hill',
    technician: 'Ethan',
    timestamp: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString(),
    tech_marked_done: true,
    photos: []
  },
  {
    ticket_id: 'WO-2026-1043',
    title: 'Furniture assembly — Boardroom',
    description: 'Assemble and place six new conference chairs before the afternoon session.',
    category: 'General Maintenance',
    location: 'Main Lodge · Boardroom',
    priority: 'Medium',
    status: 'Resolved',
    name: 'Sofia Martinez',
    technician: 'Eric',
    timestamp: new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString(),
    photos: []
  }
];
