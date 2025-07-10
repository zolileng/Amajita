import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

// 🔐 Supabase credentials (replace with yours)
const supabaseUrl = "https://quvjivpaggshwekscbmy.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9";
const supabase = createClient(supabaseUrl, supabaseKey);

let players = [];

// Load players from Supabase
async function loadPlayers() {
  const { data, error } = await supabase.from("players").select("*");
  if (error) {
    console.error("❌ Failed to load players:", error.message);
    return;
  }
  players = data;
  loadLeaderboard();
}

// Calculate points
function calculatePoints(player) {
  return player.wins * 3 + player.draws;
}

// Render leaderboard table
function loadLeaderboard() {
  const tbody = document.querySelector("#leaderboard tbody");
  tbody.innerHTML = "";

  players.sort((a, b) => calculatePoints(b) - calculatePoints(a));

  players.forEach(player => {
    const gamesPlayed = player.wins + player.losses + player.draws;
    const row = document.createElement("tr");
    row.innerHTML = `
      <td class="team-name" data-team="${player.name}">${player.name}</td>
      <td>${player.wins}</td>
      <td>${player.losses}</td>
      <td>${player.draws}</td>
      <td>${gamesPlayed}</td>
      <td>${calculatePoints(player)}</td>
    `;
    tbody.appendChild(row);
  });

  document.querySelectorAll(".team-name").forEach(el => {
    el.addEventListener("click", showLosses);
  });
}

// Show loss history
function showLosses(event) {
  const player = players.find(p => p.name === event.target.dataset.team);
  const container = document.getElementById("losses-display");
  let html = `<h3>${player.name}'s Losses</h3>`;
  const losses = Object.entries(player.lossesHistory || {}).filter(([_, count]) => count > 0);

  if (losses.length === 0) {
    html += `<p>No recorded losses.</p>`;
  } else {
    losses.forEach(([opponent, count]) => {
      html += `<p>Lost to ${opponent} ${count} time(s)</p>`;
    });
  }

  container.innerHTML = html;
}

// Handle form submit to update match result
async function updateMatchFromInput(event) {
  event.preventDefault();

  const p1name = document.getElementById("input1").value.trim();
  const p2name = document.getElementById("input2").value.trim();
  const result = document.getElementById("input3").value;

  const p1 = players.find(p => p.name.toLowerCase() === p1name.toLowerCase());
  const p2 = players.find(p => p.name.toLowerCase() === p2name.toLowerCase());

  if (!p1 || !p2 || p1.id === p2.id) {
    alert("Invalid player names.");
    return;
  }

  if (result === "draw") {
    p1.draws++; p2.draws++;
  } else if (result === "player1") {
    p1.wins++; p2.losses++;
    p2.lossesHistory[p1.name] = (p2.lossesHistory[p1.name] || 0) + 1;
  } else if (result === "player2") {
    p2.wins++; p1.losses++;
    p1.lossesHistory[p2.name] = (p1.lossesHistory[p2.name] || 0) + 1;
  } else {
    alert("Invalid result.");
    return;
  }

  // Update both players in Supabase
  await Promise.all([
    supabase.from("players").update({
      wins: p1.wins,
      losses: p1.losses,
      draws: p1.draws,
      lossesHistory: p1.lossesHistory
    }).eq("id", p1.id),
    supabase.from("players").update({
      wins: p2.wins,
      losses: p2.losses,
      draws: p2.draws,
      lossesHistory: p2.lossesHistory
    }).eq("id", p2.id)
  ]);

  await loadPlayers();
  document.getElementById("match-update-form").reset();
}

// Initial load
window.onload = () => {
  loadPlayers();
};

document.getElementById("match-update-form").addEventListener("submit", updateMatchFromInput);
