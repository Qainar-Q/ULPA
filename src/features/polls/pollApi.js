import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase.js";
import { useAuth } from "../auth/AuthContext.jsx";

const FIELDS =
  "id, question, details, group_no, multiple, anonymous, closes_at, closed, created_by, creator_name, created_at, poll_options(id, label, position)";

export function isPollOpen(poll, now = new Date()) {
  return !poll.closed && (!poll.closes_at || new Date(poll.closes_at) > now);
}

/**
 * Polls the student can see (database filters by group), with:
 *   mine    — Set of option ids I voted for (my own rows only)
 *   results — { [optionId]: { votes, voters } }, totals[pollId] = people who voted
 */
export function usePolls() {
  const { status: authStatus } = useAuth();
  const [state, setState] = useState({ status: "loading", polls: [], mine: new Set(), results: {}, totals: {} });

  const load = useCallback(async () => {
    const [polls, votes, results] = await Promise.all([
      supabase.from("polls").select(FIELDS).order("created_at", { ascending: false }).limit(100),
      supabase.from("poll_votes").select("poll_id, option_id"),
      supabase.rpc("poll_results"),
    ]);
    if (polls.error || votes.error || results.error) {
      setState((current) => ({ ...current, status: "error" }));
      return;
    }
    const byOption = {};
    const totals = {};
    for (const row of results.data) {
      byOption[row.option_id] = { votes: row.votes, voters: row.voters };
      totals[row.poll_id] = row.total_voters;
    }
    const list = polls.data.map((poll) => ({
      ...poll,
      poll_options: [...(poll.poll_options ?? [])].sort((a, b) => a.position - b.position),
    }));
    setState({ status: "ready", polls: list, mine: new Set(votes.data.map((row) => row.option_id)), results: byOption, totals });
  }, []);

  useEffect(() => {
    if (authStatus === "signedIn") load();
  }, [authStatus, load]);

  return { ...state, reload: load };
}

export async function createPoll({ question, details, groupNo, multiple, anonymous, closesAt, options }) {
  const { data: poll, error } = await supabase
    .from("polls")
    .insert({
      question: question.trim(),
      details: details?.trim() || null,
      group_no: groupNo === "both" ? null : Number(groupNo),
      multiple: Boolean(multiple),
      anonymous: Boolean(anonymous),
      closes_at: closesAt || null,
    })
    .select("id")
    .single();
  if (error) throw error;
  const rows = options.map((label, index) => ({ poll_id: poll.id, label: label.trim(), position: index }));
  const { error: optionError } = await supabase.from("poll_options").insert(rows);
  if (optionError) {
    await supabase.from("polls").delete().eq("id", poll.id); // do not leave an empty poll behind
    throw optionError;
  }
  return poll.id;
}

export async function vote(optionIds) {
  const { error } = await supabase.from("poll_votes").insert(optionIds.map((option_id) => ({ option_id })));
  if (error) throw error;
}

/** Withdraw my own votes (only while the poll is open) so I can vote again. */
export async function withdrawVote(pollId) {
  const { error } = await supabase.from("poll_votes").delete().eq("poll_id", pollId);
  if (error) throw error;
}

export async function closePoll(pollId) {
  const { error } = await supabase.from("polls").update({ closed: true }).eq("id", pollId);
  if (error) throw error;
}

export async function deletePoll(pollId) {
  const { error } = await supabase.from("polls").delete().eq("id", pollId);
  if (error) throw error;
}
