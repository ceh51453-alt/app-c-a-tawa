import { evaluateTemplate } from '../services/simulator';
import { CharacterData, SimulatorMessage } from '../types';

async function run() {
  const charData: CharacterData = {
    name: 'Tawa-Test',
    first_mes: 'Hello',
    description: 'A beautiful mother deity',
    personality: 'Compassionate',
    scenario: 'In the sanctuary',
    mes_example: 'Dialogue example',
    creator_notes: 'Creator notes',
    system_prompt: 'System prompt',
    post_history_instructions: 'Post history'
  };

  const userState = {
    stat_data: {
      power: 50,
      items: ['sword', 'shield']
    }
  };

  const chatHistory: SimulatorMessage[] = [
    { id: '1', role: 'user', content: 'hello mother', timestamp: Date.now() },
    { id: '2', role: 'assistant', content: 'hello my child', timestamp: Date.now() }
  ];

  const helpers = {
    chatHistory,
    charData,
    userName: 'Child'
  };

  console.log("--- TEST 1: getchar() ---");
  const template1 = "<% const char = await getchar(); %>Char name: <%= char.name %>, description: <%= char.description %>";
  const res1 = await evaluateTemplate(template1, 'Tawa-Test', userState, helpers);
  console.log("Result:", res1);
  if (res1.includes("Tawa-Test") && res1.includes("beautiful mother deity")) {
    console.log("TEST 1 PASSED!");
  } else {
    console.error("TEST 1 FAILED!");
  }

  console.log("\n--- TEST 2: getvar / setvar / incvar ---");
  const template2 = "<% incvar('stat_data.power', 10); %>Power: <%= getvar('stat_data.power') %>";
  const res2 = await evaluateTemplate(template2, 'Tawa-Test', userState, helpers);
  console.log("Result:", res2);
  console.log("State power value:", userState.stat_data.power);
  if (userState.stat_data.power === 60) {
    console.log("TEST 2 PASSED!");
  } else {
    console.error("TEST 2 FAILED!");
  }

  console.log("\n--- TEST 3: getChatMessage ---");
  const template3 = "Last message: <%= getChatMessage(-1).message %> (from <%= getChatMessage(-1).role %>)";
  const res3 = await evaluateTemplate(template3, 'Tawa-Test', userState, helpers);
  console.log("Result:", res3);
  if (res3.includes("hello my child") && res3.includes("assistant")) {
    console.log("TEST 3 PASSED!");
  } else {
    console.error("TEST 3 FAILED!");
  }

  console.log("\n--- TEST 4: toastr & alert stubs ---");
  const template4 = "<% toastr.success('test toast'); alert('test alert'); %>Done";
  const res4 = await evaluateTemplate(template4, 'Tawa-Test', userState, helpers);
  console.log("Result:", res4);
}

run().catch(console.error);
