# Pawse recovery research

Date: 2026-10-24 · Scope: the evidence behind the PAWSE 3.0 redesign · Status: desk research, not a systematic review

## How to read this

- **Strong:** several systematic reviews or meta-analyses agree, or a national clinical guideline says it.
- **Moderate:** at least one meta-analysis, with real caveats (heterogeneity, short follow-up, mixed populations).
- **Emerging:** small trials, pilots, correlational or qualitative work.
- **Product hypothesis:** our own reasoning. It needs testing in Pawse (see `PAWSE_VALIDATION_PLAN.md`).

Most of the evidence comes from substance use, depression and physical activity, studied in clinical or research settings. Pawse is a self-help app for everyday habits (food delivery spending, scrolling, shopping, smoking, drinking, betting). **Transfer is never guaranteed.** Effect sizes in trials are averages and say little about any one person.

The searches were run on 2026-10-24. Several results came from abstracts and secondary summaries, not full texts; those are marked "(abstract)". Figures marked "verify" should be checked against the primary paper before anyone quotes them publicly.

## 1. What the evidence says

### Self-monitoring (Moderate)
Michie et al. (2009), a meta-regression of 122 healthy-eating and physical-activity interventions, found that self-monitoring explained the most between-study heterogeneity. Interventions that combined self-monitoring with at least one other control-theory technique (goal setting, feedback, review of goals) worked better (pooled effect 0.42 vs 0.26). [Michie et al. 2009](https://ore.exeter.ac.uk/repository/handle/10871/13754) (abstract).
*Limits:* diet and activity, not addictive behaviours. The 13% figure is heterogeneity explained, not an effect size.
**Product decision:** keep the fast check-in, and pair it with goals, feedback and a weekly review of the goal. Self-monitoring alone is the weakest version.

### Relapse prevention and the abstinence violation effect (Strong as a clinical model; moderate as tested mechanism)
Marlatt's cognitive-behavioural relapse prevention model treats a lapse as a point where coping, self-efficacy and attributions decide what happens next. Relapse is more likely when a lapse brings internal blame, guilt and lower self-efficacy (the abstinence violation effect, AVE). [PMC review of relapse prevention](https://pmc.ncbi.nlm.nih.gov/articles/PMC3296289); [Wheeler, George & Marlatt 2006](https://ojp.gov/ncjrs/virtual-library/abstracts/relapse-prevention-sexual-offenders-considerations-abstinence) (abstract). Witkiewitz and Marlatt (2005) later reframed relapse as a dynamic process rather than an on/off switch.
**Product decision:** a slip screen that is calm, factual, separates the act from the person, says what still stands, and offers one coping adjustment. No streak-wipe drama, no "you failed" copy in any tone.

### Self-compassion and shame (Emerging)
A 2024 systematic review in alcohol research found higher self-compassion and self-forgiveness go with less problem drinking, but self-compassion is under-studied in treatment outcomes and many questions remain. [Systematic review, 2024](https://pmc.ncbi.nlm.nih.gov/articles/PMC11360266/). Controlled trials of self-compassion interventions for addiction are small or pilots.
**Product decision:** use non-shaming, warm language as a safety floor (it is unlikely to harm). Don't claim self-compassion "works" for relapse.

### Urge management and mindfulness (Moderate)
A systematic review of mindfulness-based relapse prevention (MBRP), which includes urge surfing, found positive effects on at least one addiction outcome in 12 of 13 studies of moderate quality. [Ramadas et al. 2021](https://pmc.ncbi.nlm.nih.gov/articles/PMC8533446/). A 2023 meta-analysis of 17 RCTs (1,228 people) found mindfulness-based interventions reduced craving (SMD −0.70, 95% CI −1.15 to −0.26) and called for higher-quality trials. [BMC Neuroscience 2023](https://link.springer.com/10.1186/s12868-023-00821-4).
No source we found gives a reliable duration for a single craving. EMA studies show lapse risk changes within a person with mood, context and craving, and timing of measurement matters. [Perski et al. 2023, Addiction](https://ueaeprints.uea.ac.uk/91996/1/Perski_etal_2023_Addiction.pdf).
**Product decision:** offer observation ("pause and notice") as one strategy among several, and **remove fixed-time promises** ("it passes in two minutes", "usually within minutes"). The person decides when it has eased.

### Coping plans and implementation intentions (Moderate to strong)
If-then plans ("If X happens, then I'll do Y") had a medium-to-large average effect on goal attainment (d ≈ 0.65 across 94 tests) in Gollwitzer and Sheeran's 2006 meta-analysis, with larger effects for specific if-then formats and motivated people. [NCI construct summary](https://cancercontrol.cancer.gov/brp/research/constructs/implementation-intentions) (verify the exact figure against the paper).
**Product decision:** the plan holds if-then plans, and the slip reflection and weekly review both turn "one thing to try" into an if-then that shows up when an urge hits.

### Stimulus control and friction (Strong as part of CBT; component evidence limited)
Changing the environment and adding steps between the person and the cue is a standard CBT and relapse-prevention technique. We did not find a meta-analysis isolating it. **Product hypothesis:** habit-specific friction ideas (log out, remove saved cards, phone in another room) are cheap, reversible and fit the habits Pawse tracks.

### Motivational interviewing (Moderate)
Across 119 studies, MI produced small but durable effects against weak comparisons (g ≈ 0.28) and was about as good as other active treatments (g ≈ 0.09, not significant). [Lundahl et al. 2010](https://digitalcommons.usu.edu/sswa_facpubs/199) (abstract). Brief MI for excessive drinking showed larger short-term effects. [Vasilaki et al. 2006](https://motivationalinterviewing.org/node/4232) (abstract).
**Product decision:** we can't deliver MI, but we can borrow its spirit: the person names their own goal (stop, cut down, or just understand it first) and reasons, and Pawse reflects those reasons back when an urge hits. No lecturing, no imposed abstinence goal.

### Behavioural activation (Strong for depression; not tested here)
Behavioural activation reduces depressive symptoms with large effects in individual therapy (g ≈ 0.85; 0.56 in low-risk-of-bias studies) [Cuijpers et al. 2023](https://www.cris.fau.de/publications/298894059/) (abstract), and also reduces anxiety and increases activation [Stein et al. 2021](https://www.cambridge.org/core/journals/psychological-medicine/article/looking-beyond-depression-a-metaanalysis-of-the-effect-of-behavioral-activation-on-depression-anxiety-and-activation/F4B92EAA32F7949A958A1147B6D5B480) (abstract).
**Product hypothesis:** "Do something else" with concrete small swaps borrows from this. It is not depression treatment and isn't presented as such.

### Social support (Emerging to moderate)
Greater social support is associated with better substance-use outcomes after treatment; people in recovery value safe, non-stigmatising communities. [Qualitative metasynthesis](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC9306622/). Peer support evidence is promising but methodologically weak. [Recovery Research Institute](https://www.recoveryanswers.org/research-post/what-is-the-evidence-for-peer-recovery-support-services/).
**Product decision:** "Reach out" as a strategy, with an optional first name only. Pawse stores no contacts and never messages anyone. A buddy feature stays out of scope (privacy cost, PRD P2).

### Digital interventions for substance use (Low certainty)
App-based smoking-cessation evidence is equivocal: a 2023 meta-analysis of nine RCTs found unclear benefit [Guo et al. 2023](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10160935/); a 2020 review of alcohol, tobacco and drug apps found effectiveness unclear [Staiger et al. 2020](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7723745/). Just-in-time adaptive interventions are promising but effectiveness studies are lacking. [Perski et al. 2022](https://discovery.ucl.ac.uk/id/eprint/10133803/9/Perski_Addiction%20-%202021%20-%20Perski%20-%20Technology%E2%80%90mediated%20just%E2%80%90in%E2%80%90time%20adaptive%20interventions%20%20JITAIs%20%20to%20reduce%20harmful%20substance.pdf).
**Product decision:** no outcome claims in the app or store copy. Pawse is a self-awareness and coping tool.

### Engagement and attrition (Moderate)
In smartphone RCTs for depression, pooled dropout was 26%, about 48% after adjusting for publication bias; dropout was lower with in-app mood monitoring and human feedback. [Torous et al. 2020](https://researchers.westernsydney.edu.au/en/publications/dropout-rates-in-clinical-trials-of-smartphone-apps-for-depressiv/) (abstract).
**Product decision:** expect gaps. Gaps must never punish the person or the pet, and returning must be easy.

### Gamification (Moderate, small effects)
Gamified apps show small-to-moderate short-term effects on physical activity (SMD ≈ 0.34, 16 studies) [Am J Prev Med 2022](https://pubmed.ncbi.nlm.nih.gov/34893387/), some persistence after follow-up [Mazeas et al. 2022](https://www.jmir.org/2022/1/E26779/), and small maintenance effects with prediction intervals crossing zero in cardiovascular populations, where feedback was the most important element [2025 meta-analysis](https://pubmed.ncbi.nlm.nih.gov/39854099/) (abstract).
Virtual pets specifically: small, short studies (e.g. a 9-day study of 39 teens where a phone pet doubled breakfast eating [Cornell](https://news.cornell.edu/node/271155)); a search summary also mentioned an RCT adding a pet game to a quit-smoking app that raised engagement (primary source not retrieved, verify). Autoethnographic work describes a drift from self-care to reward-driven use.
**Product decision:** the pet is a feedback display and a source of warmth, not a threat. Keep feedback; remove loss-of-life fear, irreversible punishment and rewards that reset on one slip.

### Language and stigma (Strong as guidance)
NIDA recommends person-first language and flags "clean/dirty" as stigmatising. [NIDA, Words Matter](https://nida.nih.gov/drug-topics/addiction-science/words-matter-preferred-language-talking-about-addiction).
**Product decision:** "goal met" and "good day" replace "clean day" in all user-facing copy. "Slip" stays: it's colloquial and non-clinical.

### Safety: alcohol withdrawal (Strong, guideline)
NICE CG100: a sudden reduction in intake can cause severe withdrawal in dependent drinkers; people not admitted should be advised to avoid a sudden reduction and be told how to contact local services. [NICE CG100](https://www.nice.org.uk/guidance/cg100/chapter/1-Guidance).
**Product decision:** the plan's "More support" card says not to stop heavy daily drinking suddenly without medical advice, and the existing professional note stays.

### AI in health (Guidance)
WHO's 2024 guidance on large multimodal models in health flags automation bias, the need for stakeholder involvement and post-release auditing. [WHO 2024](https://www.who.int/publications-detail-redirect/9789240084759).
**Product decision:** AI stays optional polish on deterministic numbers, is never a clinician, never decides life or death of the pet, runs only on what the person logged, and has server-side caps. The weekly review is deterministic.

## 2. Evidence-to-feature map

| Feature (3.0) | Basis | Strength |
|---|---|---|
| Five day states; silence is unknown | Measurement validity; attrition is normal | Product principle |
| Plan: goal, reasons, situations, first step | MI spirit; goal setting + self-monitoring | Moderate |
| If-then plans from slips and reviews | Implementation intentions | Moderate–strong |
| Urge support with switchable strategies, no time promise | MBRP, CBT coping, stimulus control | Moderate |
| Calm slip screen, progress kept | Relapse prevention / AVE | Strong model, moderate mechanism |
| Weekly review with one adjustment | Feedback + goal review (control theory) | Moderate |
| Observations with counts, "hint"/"pattern", no causation | Small-n honesty | Product principle |
| Continuity pet rules; cumulative days of care | Gamification without fear; AVE | Hypothesis |
| "Goal met" language | NIDA Words Matter | Guidance |
| Withdrawal and support guidance | NICE CG100 | Strong |

## 3. Limitations

- No systematic search, no risk-of-bias assessment by us, several abstracts only.
- Most evidence is from clinical populations and substances; Pawse users are mostly self-referred adults with everyday habits.
- None of this shows that Pawse works. The validation plan describes how to find out.
