const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient(
  'https://rzvpqeteaybwogaqodyz.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ6dnBxZXRlYXlid29nYXFvZHl6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mjg5OTA0MiwiZXhwIjoyMDg4NDc1MDQyfQ.I9zfq9bmEzLaKhApTt-ZEdj2dGwyneslUJSdS9f3KiA'
);

async function seed() {
  console.log('Seeding Azusa 120 conference...');

  // Create Conference
  const { data: conf, error: confErr } = await supabase
    .from('conferences')
    .insert({
      name: 'Azusa 120',
      description: 'Azusa Street Revival Conference',
      location: 'Angelus Temple, Los Angeles, CA',
      start_date: '2026-04-09',
      end_date: '2026-04-11',
    })
    .select()
    .single();

  if (confErr) { console.error('Conference error:', confErr); return; }
  console.log('Conference created:', conf.id);

  // Create Events
  const events = [
    { name: 'Opening Night', date: '2026-04-09', start_time: '19:00', end_time: '21:00', sort_order: 0 },
    { name: 'Morning Session', date: '2026-04-10', start_time: '09:00', end_time: '15:00', sort_order: 1 },
    { name: 'Azusa Celebration / Block Party', date: '2026-04-10', start_time: '18:00', end_time: '21:00', sort_order: 2 },
    { name: 'Final Day Morning', date: '2026-04-11', start_time: '09:00', end_time: '11:00', sort_order: 3 },
  ];

  const { data: createdEvents, error: evErr } = await supabase
    .from('events')
    .insert(events.map(e => ({ ...e, conference_id: conf.id })))
    .select();

  if (evErr) { console.error('Events error:', evErr); return; }
  console.log('Events created:', createdEvents.length);

  const [openingNight, morningSession, blockParty, finalDay] = createdEvents;

  // Sets and Songs
  const setsData = [
    // Opening Night
    {
      event_id: openingNight.id,
      name: 'John Wilds',
      sort_order: 0,
      songs: [
        { title: 'Jehovah', key: 'C', description: "Tag: There's No One like Jehovah", sort_order: 0, duration: '5:45' },
        { title: 'This Is The Air I Breath', key: 'G', description: 'Live moment — click and pad. Follow YouTube reference', sort_order: 1 },
        { title: 'All The Glory', key: 'G', artist: 'John Wilds (Unreleased)', sort_order: 2 },
        { title: 'Alpha & Omega', key: 'G', description: 'Live moment — click and pad. Follow YouTube reference', sort_order: 3 },
      ],
    },
    // Morning Session - Edward Rivera
    {
      event_id: morningSession.id,
      name: 'Edward Rivera & Bethany MSC',
      start_time: '09:30',
      sort_order: 0,
      songs: [
        { title: 'Praise', key: 'G', description: 'Bethany Remix', sort_order: 0, duration: '4:58' },
        { title: 'No One Like The Lord (We Crown You)', key: 'Bb', sort_order: 1, duration: '5:27' },
        { title: 'Holy Forever', key: 'F', sort_order: 2, duration: '5:23' },
      ],
    },
    // Morning Session - Joseph/Tosha/Jon
    {
      event_id: morningSession.id,
      name: 'Joseph / Tosha Zwanziger & Jonathan Stockstill',
      start_time: '11:30',
      sort_order: 1,
      songs: [
        { title: 'Garment of Praise', key: 'B', sort_order: 0, duration: '4:59' },
        { title: 'What A God', key: 'A', sort_order: 1, duration: '7:11' },
        { title: 'Healing Is Here', key: 'F#', sort_order: 2, duration: '6:33' },
        { title: 'Fall Like Rain', key: 'E', sort_order: 3, duration: '6:58' },
      ],
    },
    // Morning Session - Binions/Kaci/Dustin
    {
      event_id: morningSession.id,
      name: 'The Binions / Kaci Stewart / Dustin Smith',
      start_time: '13:15',
      sort_order: 2,
      songs: [
        { title: 'Doxology', key: 'F#', sort_order: 0, duration: '4:05' },
        { title: 'Here Comes The Glory', key: 'Gb', sort_order: 1, duration: '5:30' },
        { title: 'Hunger', key: 'G', sort_order: 2 },
        { title: 'My Soul Follows', key: 'Eb', sort_order: 3, duration: '5:49' },
      ],
    },
    // Morning Session - William McDowell
    {
      event_id: morningSession.id,
      name: 'William McDowell',
      start_time: '14:40',
      sort_order: 3,
      songs: [
        { title: 'Nothing Like Your Presence', key: 'F#', sort_order: 0, duration: '11:40' },
        { title: 'Spirit Break Out', key: 'G', sort_order: 1 },
        { title: 'Stay', key: 'Gb', sort_order: 2, duration: '6:36' },
        { title: 'Only You Can Satisfy', key: 'Gb', sort_order: 3, duration: '7:17' },
        { title: 'I Give Myself Away', key: 'Bb', sort_order: 4 },
      ],
    },
    // Block Party
    {
      event_id: blockParty.id,
      name: 'Azusa Block Party',
      description: 'Mashup jam session with several artists',
      sort_order: 0,
      songs: [
        { title: 'You Are Good', key: 'E', artist: 'Israel Houghton', sort_order: 0 },
        { title: 'Jesus Be The Center', key: 'A', sort_order: 1 },
        { title: 'To Worship You I Live', key: 'A', sort_order: 2, duration: '5:00' },
      ],
    },
    // Final Day
    {
      event_id: finalDay.id,
      name: 'TBD',
      description: 'Service flow TBD — will update the team',
      sort_order: 0,
      songs: [],
    },
  ];

  for (const setData of setsData) {
    const { songs, ...setInfo } = setData;
    const { data: createdSet, error: setErr } = await supabase
      .from('sets')
      .insert(setInfo)
      .select()
      .single();

    if (setErr) { console.error('Set error:', setErr); continue; }
    console.log(`Set created: ${createdSet.name}`);

    if (songs.length > 0) {
      const { data: createdSongs, error: songErr } = await supabase
        .from('songs')
        .insert(songs.map(s => ({ ...s, set_id: createdSet.id })))
        .select();

      if (songErr) { console.error('Songs error:', songErr); continue; }
      console.log(`  ${createdSongs.length} songs created`);
    }
  }

  console.log('\nSeed complete!');
  console.log(`Conference: ${conf.id}`);
}

seed().catch(console.error);
