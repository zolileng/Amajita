import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const supabaseUrl = 'https://pgnipuummegssjwpcfvi.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBnbmlwdXVtbWVnc3Nqd3BjZnZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIzMzYyMzksImV4cCI6MjA2NzkxMjIzOX0.XG7rqxUk_RRX78h7ry59jgQ-HnKgbdmjcMejnGcmHo0';

const supabase = createClient(supabaseUrl, supabaseKey);

let players = [];

async function loadPlayersFromSupabase() {
  const { data, error } = await supabase.from('players').select('*');
  if (error) {
    console.error('Failed to load players:', error);
    return;
  }
  players = data.map(player => ({
    name: player.name,
    wins: 0,
    losses: 0,
    draws: 0,
    lossesHistory: {},
  }));

  // Initialize lossesHistory keys
  for (let player of players) {
    for (let opponent of players) {
      if (player.name !== opponent.name) {
        player.lossesHistory[opponent.name] = 0;
      }
    }
  }

  await loadMatchesAndBuildStats();
}

async function loadMatchesAndBuildStats() {
  const { data: matches, error } = await supabase.from('matches').select('*');
  if (error) {
    console.error('Failed to load matches:', error);
    return;
  }

  // Reset player stats
  players.forEach(p => {
    p.wins = 0;
    p.losses = 0;
    p.draws = 0;
    for (let key in p.lossesHistory) {
      p.lossesHistory[key] = 0;
    }
  });

  matches.forEach(match => {
    const p1 = players.find(p => p.name === match.player1);
    const p2 = players.find(p => p.name === match.player2);

    if (!p1 || !p2) return; // Skip if player not found

    if (match.result === 'draw') {
      p1.draws += 1;
      p2.draws += 1;
    } else if (match.result.includes('win')) {
      if (match.result.includes(match.player1)) {
        p1.wins += 1;
        p2.losses += 1;
        p2.lossesHistory[match.player1] += 1;
      } else if (match.result.includes(match.player2)) {
        p2.wins += 1;
        p1.losses += 1;
        p1.lossesHistory[match.player2] += 1;
      }
    }
  });

  loadLeaderboard();
}

function calculatePoints(player) {
  return player.wins * 3 + player.draws;
}

function loadLeaderboard() {
  const tbody = document.querySelector('#leaderboard tbody');
  tbody.innerHTML = ''; // Clear previous data

  players.forEach(player => {
    const gamesPlayed = player.wins + player.losses + player.draws;
    const points = calculatePoints(player);

    const row = document.createElement('tr');
    row.innerHTML = `
      <td class="team-name" data-team="${player.name}">${player.name}</td>
      <td>${player.wins}</td>
      <td>${player.losses}</td>
      <td>${player.draws}</td>
      <td>${gamesPlayed}</td>
      <td>${points}</td>
    `;
    tbody.appendChild(row);
  });

  // Add click event to each team name
  const teamNames = document.querySelectorAll('.team-name');
  teamNames.forEach(team => {
    team.addEventListener('click', showLosses);
  });
}

function showLosses(event) {
  const teamName = event.target.dataset.team;
  const team = players.find(player => player.name === teamName);

  if (team) {
    let lossMessage = `<h3>${team.name}'s Losses:</h3>`;
    if (Object.keys(team.lossesHistory).length === 0) {
      lossMessage += `<p>No recorded losses.</p>`;
    } else {
      for (const [opponent, count] of Object.entries(team.lossesHistory)) {
        lossMessage += `<p>${team.name} lost to ${opponent} ${count} time(s).</p>`;
      }
    }

    const lossDisplay = document.querySelector('#losses-display');
    lossDisplay.innerHTML = lossMessage;
  }
}

async function saveMatchToSupabase(player1, player2, result) {
  const { data, error } = await supabase.from('matches').insert([
    { player1: player1, player2: player2, result: result },
  ]);

  if (error) {
    console.error('Error saving match:', error);
  } else {
    console.log('Match saved:', data);
  }
}

async function updateMatchFromInput(event) {
  event.preventDefault();

  const player1 = document.getElementById('input1').value.trim();
  const player2 = document.getElementById('input2').value.trim();
  const result = document.getElementById('input3').value.trim();

  if (!player1 || !player2 || !result) {
    alert('Please fill all fields.');
    return;
  }

  const player1Team = players.find(p => p.name.toLowerCase() === player1.toLowerCase());
  const player2Team = players.find(p => p.name.toLowerCase() === player2.toLowerCase());

  if (!player1Team || !player2Team) {
    alert('One or both players do not exist!');
    return;
  }

  if (result === 'draw') {
    player1Team.draws += 1;
    player2Team.draws += 1;
  } else if (result.includes('win') && result.includes(player1)) {
    player1Team.wins += 1;
    player2Team.losses += 1;
    if (!player2Team.lossesHistory[player1]) player2Team.lossesHistory[player1] = 0;
    player2Team.lossesHistory[player1] += 1;
  } else if (result.includes('win') && result.includes(player2)) {
    player2Team.wins += 1;
    player1Team.losses += 1;
    if (!player1Team.lossesHistory[player2]) player1Team.lossesHistory[player2] = 0;
    player1Team.lossesHistory[player2] += 1;
  } else {
    alert('Invalid match result!');
    return;
  }

  await saveMatchToSupabase(player1, player2, result);

  await loadMatchesAndBuildStats();

  document.getElementById('match-update-form').reset();
}

window.onload = loadPlayersFromSupabase;

document.getElementById('match-update-form').addEventListener('submit', updateMatchFromInput);
