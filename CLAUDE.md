<rules owner="Rob Tolboom" project="vetrix-validation-study" version="2026-03-06">
  <meta_rules>
    <rule_1>Always ask y/n confirmation before performing file, git, build, or CI actions.</rule_1>
    <rule_2>User has final authority; do not change any plan without explicit approval.</rule_2>
    <rule_3>Report a short execution plan with exact commands first; wait for approval.</rule_3>
    <rule_4>Follow repository policies and @CONTRIBUTING.md; do not reinterpret or modify these rules.</rule_4>
    <rule_5>Display the section titles and all applicable rules below verbatim at the start of EVERY response, in this order.</rule_5>
  </meta_rules>

  <workflows>
    <start_of_day>
      <step_1>git pull origin main</step_1>
    </start_of_day>

    <before_commit>
      <step_1>git diff --staged (review changes)</step_1>
      <step_2>git commit -m "type: description"</step_2>
    </before_commit>
  </workflows>

  <feature_planning>
    <planning_phase>
      <rule>Create a planning markdown in the "docs/plans" directory with goal, scope, task list, risks, and acceptance criteria.</rule>
    </planning_phase>
    <development>
      <rule>Never commit directly to main. Always create a feature/bugfix branch first.</rule>
      <rule>Commit regularly with clear descriptions.</rule>
      <rule>Push and PR only after explicit user approval.</rule>
    </development>
  </feature_planning>

  <change_management>
    <on_every_change>
      <rule>Update relevant documentation (README.md, etc.).</rule>
    </on_every_change>
  </change_management>

  <display_policy>
    <conditions>
      <rule>If the task involves file/git/build/CI actions or branch/PR: display all rules in &lt;meta_rules&gt;, the relevant &lt;workflows&gt; steps, and &lt;change_management&gt;.</rule>
      <rule>Otherwise: display only &lt;meta_rules&gt; and the section headings of this document.</rule>
    </conditions>
    <verbatim>Display must be verbatim; no paraphrasing or summarizing beyond the conditions above.</verbatim>
    <self_reference>This &lt;display_policy&gt; is itself subject to the display requirement.</self_reference>
  </display_policy>

  <project_context>
    <!-- To be filled in as the project develops -->
    <description>Webapp for the Vetrix podcast validation study</description>
    <code_style>
      <commits>Conventional Commits: feat:, fix:, docs:, refactor:, test:, chore:</commits>
    </code_style>
  </project_context>
</rules>
