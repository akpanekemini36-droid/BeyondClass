from pathlib import Path
from xml.sax.saxutils import escape
from reportlab.pdfgen import canvas
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'output' / 'pdf'
OUT.mkdir(parents=True, exist_ok=True)
PDF = OUT / 'BeyondClass-Mathematics-Curriculum.pdf'
for name, filename in [('BC','arial.ttf'),('BC-Bold','arialbd.ttf'),('BC-Italic','ariali.ttf')]:
    pdfmetrics.registerFont(TTFont(name, str(Path('C:/Windows/Fonts') / filename)))
pdfmetrics.registerFontFamily('BC', normal='BC', bold='BC-Bold', italic='BC-Italic', boldItalic='BC-Bold')
INK = colors.HexColor('#17191C')
GRAY = colors.HexColor('#555B61')
LIGHT = colors.HexColor('#F1F2F2')
LINE = colors.HexColor('#D7DADC')
W,H=A4
WIDTH=W-88
STYLES={
 'body':ParagraphStyle('body',fontName='BC',fontSize=9.5,leading=14,textColor=INK,spaceAfter=8),
 'small':ParagraphStyle('small',fontName='BC',fontSize=8.1,leading=11.5,textColor=GRAY,spaceAfter=6),
 'cell':ParagraphStyle('cell',fontName='BC',fontSize=8.5,leading=12,textColor=INK),
 'th':ParagraphStyle('th',fontName='BC-Bold',fontSize=8.3,leading=11.5,textColor=colors.white),
 'h2':ParagraphStyle('h2',fontName='BC-Bold',fontSize=12,leading=16,textColor=INK,spaceBefore=9,spaceAfter=7),
 'title':ParagraphStyle('title',fontName='BC-Bold',fontSize=25,leading=29,textColor=INK,spaceAfter=10),
 'kicker':ParagraphStyle('kicker',fontName='BC-Bold',fontSize=8,leading=11,textColor=GRAY,spaceAfter=9),
}
story=[]
page_titles=[]
def p(txt,style='body'):
    return Paragraph(txt,STYLES[style])
def para(txt,style='body'):
    story.append(p(txt,style))
def h2(txt): story.append(p(txt,'h2'))
def page(kicker,title,sub=''):
    if story: story.append(PageBreak())
    page_titles.append(title)
    story.append(p(kicker.upper(),'kicker'))
    story.append(p(title,'title'))
    if sub: para(sub)
def table(headers, rows, widths=None):
    if widths is None: widths=[WIDTH*.14,WIDTH*.43,WIDTH*.43]
    data=[[p(escape(str(x)),'th') for x in headers]]
    data += [[p(str(x),'cell') for x in row] for row in rows]
    t=Table(data,colWidths=widths,repeatRows=1,hAlign='LEFT')
    t.setStyle(TableStyle([
        ('BACKGROUND',(0,0),(-1,0),INK),('VALIGN',(0,0),(-1,-1),'TOP'),
        ('LEFTPADDING',(0,0),(-1,-1),9),('RIGHTPADDING',(0,0),(-1,-1),9),
        ('TOPPADDING',(0,0),(-1,-1),8),('BOTTOMPADDING',(0,0),(-1,-1),8),
        ('ROWBACKGROUNDS',(0,1),(-1,-1),[colors.white,LIGHT]),
        ('LINEBELOW',(0,-1),(-1,-1),.5,LINE),
    ]))
    story.extend([t,Spacer(1,10)])
def note(txt):
    t=Table([[p(txt,'small')]],colWidths=[WIDTH])
    t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,-1),LIGHT),('BOX',(0,0),(-1,-1),.5,LINE),('LEFTPADDING',(0,0),(-1,-1),11),('RIGHTPADDING',(0,0),(-1,-1),11),('TOPPADDING',(0,0),(-1,-1),10),('BOTTOMPADDING',(0,0),(-1,-1),6)]))
    story.extend([t,Spacer(1,7)])

# 01
page('BeyondClass Math / Curriculum handbook','Mathematics<br/>beyond the classroom.')
story.append(Spacer(1,20))
para('Teaching curriculum &amp; schemes of work','h2')
para('Primary foundations to advanced secondary mathematics. A proposed, adaptable teaching framework for the curricula listed by BeyondClass.')
story.append(Spacer(1,20))
table(['School pathways','Examination pathways'],[
 ['Primary &amp; lower-secondary foundations','GCSE Mathematics'],
 ['US Common Core Mathematics','AS &amp; A Level Mathematics'],
 ['Canadian provincial mathematics*','SAT Math preparation'],
 ['International Baccalaureate mathematics*','WAEC / NECO General Mathematics'],
], [WIDTH/2,WIDTH/2])
story.append(Spacer(1,20))
note('<b>Designed for personal tutoring.</b> Every learner begins with a diagnostic assessment. Tutors select the appropriate grade, qualification, depth and pace, then teach for understanding, fluency and independent problem-solving.')
para('*Canadian provincial and IB requests require confirmation of a suitable tutor, as stated in BeyondClass\'s current programme information. Inclusion here is a planning framework, not a guarantee of availability.','small')
story.append(Spacer(1,30))
para('<b>Edition 1.0 | 16 October 2026</b>')
para('Prepared for BeyondClass Math Tutoring Services<br/>hellobeyondclass@gmail.com<br/>beyondclassmath.netlify.app','small')

# 02
page('01 / Using this handbook','One framework. The right pathway.','This is an original proposed BeyondClass teaching curriculum, informed by official curriculum and assessment sources. It is a scope and sequence with schemes of work, rather than a set of scripted lessons or a reproduction of official syllabuses.')
table(['Pages','Pathway / resource','Use'],[
 ['3','Teaching and assessment model','Planning lessons, homework and progress reviews.'],
 ['4-5','Primary and lower-secondary foundations','Placement, catch-up and readiness for secondary study.'],
 ['6-7','GCSE Mathematics','A two-year route with Foundation and Higher differentiation.'],
 ['8-9','AS &amp; A Level Mathematics','Two-year England route; adapt for the named board.'],
 ['10-12','US Common Core Mathematics','Kindergarten to Grade 8, then high-school course routes.'],
 ['13-14','SAT Math','A focused 12-week preparation programme.'],
 ['15-17','Nigeria: foundations and WAEC / NECO','Primary/JSS bridging and SS1-SS3 preparation.'],
 ['18-19','Canadian provincial mathematics','Adaptable plans, with Ontario and B.C. examples.'],
 ['20-22','International Baccalaureate','PYP/MYP support and DP route-specific planning.'],
 ['23','Learner plan and progress record','A reusable tutor planning template.'],
 ['24-25','Sources and alignment notes','Official references and programme-scope evidence.'],
])
h2('Choose before teaching')
para('Record the school year/grade, country or province, exam board, qualification code, tier or route, assessment year, current school sequence and learning needs. A school textbook or grade label alone does not establish the complete syllabus.')
note('<b>Pacing convention:</b> an academic-year plan uses 36 taught weeks, usually three 12-week terms. Weeks are planning blocks, not fixed calendar dates. Suggested tutoring is two 60-minute sessions weekly, with school instruction and independent practice alongside it. Full qualifications may need more time. All pacing and internal targets in this handbook are proposals.')

# 03
page('02 / Teaching model','Understand. Practise. Apply.','Use the same supportive learning cycle across every pathway; vary the content and demand according to the learner.')
table(['Stage','Tutor action','Evidence to collect'],[
 ['Entry','Review school work; give a short, low-pressure diagnostic; ask the learner to explain methods.','A strand profile, prerequisite gaps and two or three initial goals.'],
 ['Teach','Use objects, diagrams, worked examples and precise mathematical vocabulary. Connect each new idea to previous learning.','The learner can explain why a method works and recognise when to use it.'],
 ['Practise','Move from guided questions to independent work; mix current and previously learned material.','Accurate working with decreasing prompts; corrections explained in an error log.'],
 ['Apply','Use unfamiliar problems, investigations and appropriate exam questions.','A justified choice of method, a sensible answer and clear communication.'],
 ['Review','Revisit a concept after one week and again after several weeks. Adapt the next lessons.','Retention and transfer, not just a high score immediately after teaching.'],
])
h2('A suggested 60-minute lesson')
para('<b>0-8 min:</b> retrieval and homework feedback. <b>8-20:</b> explanation and modelling. <b>20-35:</b> guided practice. <b>35-50:</b> independent or contextual problem. <b>50-60:</b> exit check, reflection and next steps. Younger learners may need shorter activity cycles.')
h2('Assessment and communication')
para('Use a brief exit check each lesson and a unit check every four to six weeks. Schedule a cumulative progress assessment about every two months, consistent with the BeyondClass website. Give families a short weekly update: learning covered, evidence of progress, current difficulty and the next focus.')
note('<b>Proposed mastery rule:</b> move on when the learner completes at least 80% of a suitably varied internal check independently, explains one method and succeeds on a later retrieval check. This is an internal teaching decision, not an exam grade boundary. Reteach prerequisites when the evidence is weak.')

# 04
page('03 / Shared foundations','Primary mathematics','Place by demonstrated understanding. These stages are a shared tutoring progression; they are not exact equivalences between countries or grades. England curriculum reference: [S1].')
table(['Stage','Teaching content','Observable outcomes'],[
 ['Early number','Counting, comparison, part-whole relationships, number bonds, simple addition/subtraction, shape and position.','Count a collection reliably; represent a number in two ways; explain a simple joining or separating problem.'],
 ['Developing number','Place value, written addition/subtraction, multiplication as grouping, division as sharing, simple fractions.','Explain regrouping; connect multiplication and division; represent halves and quarters using equal parts.'],
 ['Multiplicative thinking','Times tables, efficient calculation, fractions of quantities, equivalent fractions, decimals, length and mass.','Choose an operation for a word problem; compare fractions with a model; use and convert familiar units.'],
 ['Upper primary','Four operations with larger numbers, fraction operations, decimal arithmetic, percentage, ratio, area and volume.','Solve a multistep problem, estimate to check it and explain the relationship between fractions, decimals and percentages.'],
 ['Secondary readiness','Order of operations, negative numbers, coordinates, simple equations, proportional thinking and data interpretation.','Use symbols for an unknown; locate points; interpret a graph and justify a proportional comparison.'],
])
h2('A repeating 36-week primary structure')
para('<b>Weeks 1-12:</b> number and operations, with weekly measurement or shape tasks. <b>13-24:</b> fractions, proportional ideas and measurement at the learner\'s stage. <b>25-32:</b> patterns, geometry, data and mixed applications. <b>33-36:</b> an investigation, retrieval and readiness assessment. Revisit all strands throughout the year.')
h2('Performance task')
para('Plan a small class celebration. Learners count or scale quantities, compare prices, measure a space and present a simple chart at an appropriate level. Assess representation, calculation, explanation and checking. Use objects and drawings before symbolic procedures when needed.')

# 05
page('03 / Shared foundations','Lower-secondary mathematics','A suggested bridge to GCSE, US high-school mathematics, Nigerian senior secondary or a provincial/IB course. Use the actual school requirements to choose depth. [S1]')
table(['Weeks','Teaching sequence','Exit evidence'],[
 ['1-6','Integers; fraction and decimal operations; factors, multiples, powers and estimation.','Solve mixed arithmetic problems and explain signs, order of operations and reasonableness.'],
 ['7-12','Ratio, percentage, rates, unit conversion and direct proportion.','Compare offers, scale a recipe and solve a percentage-change problem with units.'],
 ['13-18','Expressions; substitution; equations and inequalities; sequences.','Write an equation from a context, solve it and check the solution by substitution.'],
 ['19-24','Coordinates; straight-line graphs; transformations; angles and polygons.','Connect a table, graph and rule; justify an angle result using named properties.'],
 ['25-30','Area, surface area and volume; Pythagoras; introductory right-triangle trigonometry when required.','Draw and label a model, select a formula and state the answer with suitable units.'],
 ['31-36','Data collection; averages and spread; probability; mixed reasoning and review.','Critique a graph, compare data sets and predict or simulate a simple event.'],
])
h2('Progression over several school years')
para('In an earlier year, prioritise concrete models, one-step equations and familiar shapes. In a middle year, add connected representations and multistep applications. In a later year, deepen algebraic manipulation, generalisation and proof. Repeat this structure at increasing demand rather than treating it as one universal year-group syllabus.')
h2('Diagnostic checkpoints')
para('Before algebra, check integer and fraction fluency. Before proportional reasoning, check multiplication and unit rate. Before trigonometry, check scale, substitution and Pythagoras. Before statistics, check graph scales, fractions and percentages.')
note('<b>Sample task:</b> compare two travel plans with different starting fees and rates. The learner builds a table, writes rules, plots graphs and explains the break-even point. Extend to inequalities only after the underlying relationships are secure.')

# 06
page('04 / GCSE Mathematics','GCSE: two-year scheme','Suggested Years 10-11 sequence, 36 taught weeks per year. This baseline follows England GCSE content; Foundation/Higher depth and exact assessment arrangements must be matched to the exam board. [S2]')
table(['Block','Topics and sequence','Learner outcome'],[
 ['Y10 1-6','Number: place value, fractions, decimals, percentage, indices, standard form, estimation and bounds at the required depth.','Calculate accurately and explain the effect of rounding in a practical problem.'],
 ['Y10 7-12','Algebra: notation, expanding/factorising, substitution, equations, inequalities and sequences.','Form and solve a mathematical statement and justify each step.'],
 ['Y10 13-18','Ratio, proportion and rates: scaling, compound measures, financial calculations and growth.','Choose additive or multiplicative reasoning and interpret a rate in context.'],
 ['Y10 19-24','Geometry: angle reasoning, polygons, constructions, loci, congruence, similarity and transformations.','Draw accurately and justify a geometric result.'],
 ['Y10 25-30','Measures: perimeter, area, circles, surface area, volume, Pythagoras and right-triangle trigonometry.','Build a diagram and solve a connected measurement problem.'],
 ['Y10 31-36','Statistics/probability introduction, mixed retrieval, end-of-year assessment and gap repair.','Interpret a distribution and distinguish a theoretical probability from an observed frequency.'],
 ['Y11 1-6','Deeper algebra and graphs; quadratics, simultaneous equations, functions and proof at the chosen tier.','Connect algebraic and graphical solutions; test whether an answer is valid.'],
 ['Y11 7-12','Advanced proportion and geometry; vector reasoning and further trigonometry where required.','Select a strategy for a problem combining several topics.'],
 ['Y11 13-18','Probability and statistics consolidation; sampling, representations and tier-appropriate conditional reasoning.','Compare evidence and explain the limitations of a conclusion.'],
 ['Y11 19-36','Three revision cycles: diagnose and reteach; timed topic/paper practice; final mocks and targeted correction.','Show reliable working, manage time and retain gains on later unfamiliar questions.'],
])
para('Within every block, use short retrieval sets from earlier blocks and one extended reasoning task. Adjust the calendar around the learner\'s school tests and actual exam dates.','small')

# 07
page('04 / GCSE Mathematics','GCSE: depth and assessment','All learners need fluency, reasoning and problem-solving. Differentiate by the current specification, not by labelling a learner permanently as weak or strong.')
table(['Area','Foundation emphasis','Higher extension / depth'],[
 ['Number','Secure arithmetic; fraction/decimal/percentage conversion; estimation and routine standard form.','Deeper surd manipulation, fractional indices and more demanding bounds problems.'],
 ['Algebra','Linear methods; simple quadratics; sequences; graphs and practical formulae.','Algebraic fractions, harder quadratics, nonlinear simultaneous equations and formal algebraic proof.'],
 ['Proportion','Ratios, unit rates, percentages, direct proportion and accessible compound measures.','Inverse proportion models and multistep growth/decay or rate problems.'],
 ['Geometry','Accurate measures, Pythagoras, right-triangle trigonometry and basic vector interpretation.','Circle-theorem proof, sine/cosine rules, vector arguments and more demanding similarity.'],
 ['Data &amp; chance','Read representations, calculate summaries and use suitable probability diagrams.','Deeper conditional probability and more demanding statistical representations.'],
])
h2('Three assessment tasks')
para('<b>Fluency:</b> a short mixed set including arithmetic, algebra and interpretation. <b>Reasoning:</b> explain whether a geometric or numerical claim is always true, sometimes true or false. <b>Problem-solving:</b> compare designs for a container under cost and size constraints, showing assumptions and units.')
h2('Revision routine')
para('Use current board materials and mark schemes. Rotate non-calculator and calculator practice as required. After each timed attempt, classify errors as concept, method, reading, accuracy or time management. Correct the cause, then use a different question one week later to test improvement.')
note('<b>Board alignment:</b> the examples above are teaching emphases, not a definitive tier checklist. GCSE, International GCSE, Scottish qualifications and other national routes have different specifications. Add an International GCSE route only after confirming that BeyondClass can support the named syllabus; do not assume it is identical to GCSE.')
para('Reference: England GCSE subject content [S2]. Specific board content must control inclusion, tier and demand.','small')

# 08
page('05 / AS & A Level Mathematics','A Level: first-year scheme','A proposed 36-week first year for the England A Level route. The AS subset, board order, statistics data requirements and assessment entry must be verified separately. Pure, statistics and mechanics are interleaved. [S3-S4]')
table(['Weeks','Pure mathematics','Applied mathematics / exit evidence'],[
 ['1-6','Algebraic fluency, surds, indices, quadratics, inequalities, graphs and proof by deduction/counterexample.','Sampling, data types and summaries. Explain why a sample or a graph may mislead.'],
 ['7-12','Coordinate geometry of lines/circles; polynomial methods; binomial expansion for positive integer powers.','Units, vectors, motion graphs and constant-acceleration models. Translate a situation into a diagram and equations.'],
 ['13-18','Trigonometric ratios, identities and equations; functions and transformations at first-year depth.','Probability rules and distributions, including binomial models. State and check modelling assumptions.'],
 ['19-24','Differentiation of powers; gradients, tangents, stationary points and optimisation.','Forces and Newton\'s laws in simple connected contexts. Interpret a result physically.'],
 ['25-30','Integration of powers; definite integrals and area; exponentials and logarithms.','Introductory hypothesis testing where in the AS/first-year content. Give a conclusion in context.'],
 ['31-36','Mixed problem-solving, proof, retrieval and transition to second-year content.','Cumulative pure/applied assessment, error analysis and a personalised summer bridge.'],
])
h2('Entry and exit expectations')
para('<b>Entry:</b> secure Higher GCSE algebra, fractions, graph interpretation and trigonometry. Begin with a bridging block if manipulation or notation is insecure. <b>Exit:</b> construct a connected solution, state assumptions and use both algebra and a graph to interpret a result.')
h2('Suggested investigation')
para('Model a moving object using a simplified journey. Compare a distance-time graph with a velocity-time graph, calculate a relevant gradient or area and explain where constant-acceleration assumptions break down. Assess mathematics and interpretation separately.')
note('<b>Course boundary:</b> this handbook covers Mathematics. Further Mathematics and International A Levels require separate qualification-specific content maps and confirmed tutor support.')

# 09
page('05 / AS & A Level Mathematics','A Level: second-year scheme','A proposed second 36-week year. Revisit first-year topics throughout, and include proof, modelling and calculator fluency in every block. [S3-S4]')
table(['Weeks','Pure mathematics','Applied mathematics / exit evidence'],[
 ['1-6','Functions and inverses; partial fractions; sequences/series and general binomial expansion.','Conditional probability and normal models. Choose a suitable distribution and justify parameters.'],
 ['7-12','Radians; trigonometric identities and equations; parametric representations.','Hypothesis tests and interpretation, including required data contexts. Distinguish a statistical conclusion from certainty.'],
 ['13-18','Chain, product and quotient rules; implicit/parametric differentiation; further optimisation.','Variable-acceleration kinematics using calculus. Connect displacement, velocity and acceleration.'],
 ['19-24','Integration by substitution/parts and partial fractions; differential equations in context.','Forces, friction, projectiles and moments. State sign conventions and modelling assumptions.'],
 ['25-30','Numerical methods, iteration and numerical integration; vectors and connected pure problems.','Mixed applied modelling. Check units and evaluate whether answers are physically meaningful.'],
 ['31-36','Full-course retrieval, timed assessment and focused reteaching.','Board-format mocks followed by correction conferences and fresh transfer questions.'],
])
h2('Core performance outcomes')
para('The learner should be able to build a mathematical model from prose, select a method without a topic label, present a coherent argument and evaluate limitations. Assess proof and reasoning alongside procedural accuracy. Use the board\'s prescribed data set where applicable.')
h2('Preparation for exams')
para('Practise interpreting exact versus approximate answers, reading mathematical notation, handling calculator outputs and writing conclusions in context. Keep a formula-retrieval record and an error log. Review a complete paper only after allowing the learner an independent attempt under realistic conditions.')
note('<b>Allocation rule:</b> tutoring time follows diagnostic need and the official assessment objectives. The equal-length blocks above are a planning scaffold, not a claim that every topic has equal examination weight or can be taught from scratch in that time.')

# 10
page('06 / US Common Core','Common Core: K-5','A grade-by-grade tutoring progression drawn from the broad Common Core sequence. Use the adopted state standards and school pacing to make the detailed plan; not every US state uses the same version. [S5]')
table(['Grade','Core content focus','Proposed demonstration of learning'],[
 ['K','Counting/cardinality; small-number addition and subtraction; shape; comparison and measurement.','Represent a small number with objects, a picture and a numeral; explain how a group changes.'],
 ['1','Addition/subtraction; place value; length and time; shapes and equal parts.','Solve a story problem, use a tens-and-ones representation and explain a strategy.'],
 ['2','Base-ten understanding; addition/subtraction; standard measurement; time/money and data.','Compare two methods for a calculation; measure accurately and organise results.'],
 ['3','Multiplication/division; fractions as numbers; area; measurement/data and shape categories.','Build an array, explain the related division fact and locate a fraction on a number line.'],
 ['4','Multidigit arithmetic; equivalent fractions and operations; decimals; angles and shape properties.','Justify a fraction comparison and solve a multistep measurement problem with a diagram.'],
 ['5','Fraction operations; decimal arithmetic; volume; coordinate plane and numerical patterns.','Model a fraction calculation, explain volume using unit cubes and plot a contextual relationship.'],
])
h2('Suggested year structure for each grade')
para('<b>Weeks 1-12:</b> grade-level number and operation foundations. <b>13-24:</b> the grade\'s major fraction, place-value or multiplicative ideas. <b>25-32:</b> geometry, measurement, data and connected applications. <b>33-36:</b> mixed retrieval, an investigation and transition assessment. Integrate shorter geometry and data experiences throughout all terms.')
h2('Practice and assessment')
para('Ask learners to represent, explain, calculate and apply. Use a short oral explanation, a model and independent questions rather than relying only on a speed test. Scale homework to attention and readiness, with short, spaced practice on several days.')
note('For all US grades, embed the mathematical practices: make sense of problems, reason, argue, model, choose tools, attend to precision, notice structure and identify repeated reasoning. A standard is a learning expectation; the teaching sequence here is BeyondClass\'s proposal.')

# 11
page('06 / US Common Core','Common Core: Grades 6-8','Run a separate 36-week plan for each grade. Use prerequisite checks before advancing to formal algebra and geometric reasoning. [S5]')
table(['Grade','Term 1 / weeks 1-12','Terms 2-3 / weeks 13-36'],[
 ['6','Ratios and unit rates; fraction division; rational numbers and operations.','Expressions/equations; coordinate reasoning; area/surface area/volume; statistical variability and distributions; cumulative review.'],
 ['7','Proportional relationships; rational-number operations; multistep percentage problems.','Expressions/equations; scale drawings and geometric measurement; sampling, comparisons and chance models; cumulative review.'],
 ['8','Irrational numbers; integer exponents; scientific notation; equations.','Functions and linear relationships; simultaneous equations; congruence/similarity; Pythagoras, volume and bivariate data; cumulative review.'],
])
h2('Grade-specific exit tasks')
para('<b>Grade 6:</b> compare drink recipes using ratios, convert the quantities and explain which representation makes the comparison clearest. Include a distribution of class preferences and discuss variation.')
para('<b>Grade 7:</b> design a scale drawing of a small room within a budget. Calculate measurement and percentage quantities, then evaluate whether a survey of preferences is representative.')
para('<b>Grade 8:</b> compare two service plans with linear models, solve their intersection and interpret it. Extend to a scatterplot investigation, distinguishing association from a proven cause.')
h2('Assessment design')
para('Every four to six weeks, assess a mix of routine skills, reasoning and an unfamiliar application. In weeks 12, 24 and 36, collect a cumulative performance task. Include both symbolic work and a written explanation, and check earlier grade prerequisites when a learner struggles.')
note('<b>High-school readiness:</b> a learner is ready to progress when they can manipulate expressions, solve linear equations, connect tables/graphs/equations and reason proportionally with limited prompting. Placement also follows the school\'s course-entry rules; the tutoring assessment does not replace them.')

# 12
page('06 / US Common Core','Common Core: high school','Schools may organise the high-school standards into Algebra I, Geometry and Algebra II, or an integrated sequence. The strands below are a content map, not a universal grade assignment. [S5]')
table(['Strand','Teaching content','Evidence / suggested task'],[
 ['Number &amp; quantity','Real-number structure, exponents, radicals, units and quantitative reasoning; course-required complex numbers.','Check dimensional consistency and explain whether a numerical result is meaningful.'],
 ['Algebra','Expressions, equations, inequalities, systems and polynomial/rational relationships at course depth.','Build and solve a model with constraints; reject an inadmissible solution.'],
 ['Functions','Notation, features, transformations; linear, quadratic, exponential and other required families.','Compare candidate models using tables, graphs and contextual evidence.'],
 ['Geometry','Congruence, similarity, proof, right-triangle trigonometry, circles, coordinates and measurement.','Write a justified geometric argument and apply it to a design problem.'],
 ['Statistics &amp; probability','Distributions, bivariate data, study design, inference concepts and conditional probability.','Evaluate a statistical claim and explain what the study can support.'],
 ['Modelling','Formulate a question; select variables; make assumptions; calculate, validate and refine.','Produce a short report that interprets results and explains model limitations.'],
])
h2('Suggested 36-week course patterns')
para('<b>Algebra I:</b> 1-12 linear relationships and systems; 13-24 exponential/quadratic relationships; 25-32 data, modelling and connections; 33-36 review. <b>Geometry:</b> 1-12 transformations and proof; 13-24 similarity, trigonometry and circles; 25-32 coordinates/measurement; 33-36 review.')
para('<b>Algebra II:</b> 1-12 polynomial and rational work; 13-24 course-required exponential, logarithmic and trigonometric functions; 25-32 probability/statistics and modelling; 33-36 review. In an integrated route, redistribute these strands to the school\'s Mathematics I-III sequence.')
note('<b>Scope control:</b> advanced content marked (+) in Common Core and courses such as Precalculus, Calculus or AP Mathematics need a separate course map. Do not assume they are part of every Common Core high-school course or already confirmed BeyondClass offerings.')

# 13
page('07 / SAT Math','SAT Math: a 12-week plan','Suggested intensity: two guided sessions weekly plus three independent practice blocks. Begin with an official practice result and adapt the plan to the test date and the learner\'s domain profile. SAT preparation here covers mathematics only. [S6-S8]')
table(['Weeks','Teaching focus','Evidence and independent work'],[
 ['1','Diagnostic; prerequisite arithmetic/algebra; Bluebook orientation and calculator decisions.','Create a domain profile and error log. Record target skills rather than promising a score increase.'],
 ['2-3','Algebra: linear equations/functions, systems and inequalities.','Translate word problems; interpret parameters; practise both multiple-choice and student-produced responses.'],
 ['4-5','Advanced Math: equivalent expressions, quadratics and other nonlinear relationships.','Compare symbolic and graphical methods. Complete a fresh mixed check after corrections.'],
 ['6','Problem-Solving and Data Analysis: ratios, rates, percentages, units and one-variable data.','Interpret a table or distribution and keep units consistent. Take a midpoint practice assessment.'],
 ['7','Data analysis continued: two-variable data, probability, sampling and statistical claims.','Explain what a reported result means and whether a claim is justified.'],
 ['8','Geometry and Trigonometry: lines, angles, triangles, circles, area/volume and right triangles.','Sketch useful diagrams and recognise the relationships before calculating.'],
 ['9-10','Mixed adaptive-style practice; difficult question selection; efficient method choice.','Use timed modules. Review avoidable errors and solve fresh questions on the same weaknesses.'],
 ['11','Official full-length practice in Bluebook; targeted repair.','Compare performance with the baseline by domain and error type, considering normal variation.'],
 ['12','Final retrieval; stable routines; light timed practice and readiness review.','Explain the plan for pacing, checking responses and handling unfamiliar questions.'],
])
note('<b>Test-aware practice:</b> current SAT Math uses two modules, with 44 questions in 70 minutes. Practise the official digital environment, its tools and permitted calculator use. Verify arrangements and approved accommodations for the actual sitting. [S7-S8]')

# 14
page('07 / SAT Math','SAT Math: what mastery looks like','Use the four official content domains to organise the learner\'s progress record. The learning outcomes and task examples below are proposed tutoring choices. [S6]')
table(['Domain','Learner outcome','Original practice task'],[
 ['Algebra','Form, solve and interpret linear relationships, systems and inequalities.','Compare a fixed-fee delivery service with a pay-per-item service; interpret the intersection in context.'],
 ['Advanced Math','Recognise equivalent expressions; solve nonlinear equations and analyse functions.','Determine a parameter so a quadratic meets a stated condition, then verify with a second method.'],
 ['Problem<br/>solving &amp; data','Use proportional reasoning and evaluate quantitative or statistical information.','Interpret a poll, distinguish sample from population and explain what a margin of error means for a claim.'],
 ['Geometry &amp; trigonometry','Use geometric relationships to calculate and reason efficiently.','Find a missing measurement from a circle/triangle diagram, showing which relationship makes the information sufficient.'],
])
h2('Independent study routine')
para('<b>Block A:</b> a short targeted set on the weakest skill. <b>Block B:</b> a mixed set from at least two domains. <b>Block C:</b> a timed set followed by an error review. Save some official practice material for independent, realistic checkpoints.')
h2('Calculator fluency')
para('Teach learners to choose between algebra, mental calculation and graphing tools. Useful habits include checking a graph window, interpreting intersections, estimating before computing and checking whether a returned value answers the question. A tool output must still be interpreted correctly.')
h2('Readiness evidence')
para('Track accuracy on new questions, repeated error types, completion within a timed module and independence. Use official practice reports for score estimates; a small homemade quiz does not reliably predict an SAT score. Set the final target from the learner\'s own baseline and admissions needs.')
note('<b>Shorter timeline:</b> keep the diagnostic, focus most teaching time on the largest skill gaps, retain mixed retrieval and include at least one realistic official practice experience. Avoid compressing all 12 weeks into a promise of complete coverage.')

# 15
page('08 / Nigerian mathematics','Nigeria: primary and JSS bridge','A proposed tutoring progression towards senior secondary General Mathematics. Match the detailed year-by-year content to the learner\'s school scheme and the applicable NERDC curriculum edition. [S9-S10]')
table(['Stage','Priority teaching content','Readiness evidence'],[
 ['Primary 1-3','Counting, place value, operations, elementary fractions, money, time, measurement, shapes and simple data.','Use concrete representations; solve familiar story problems and describe a method.'],
 ['Primary 4-6','Whole-number operations, fraction/decimal/percentage connections, ratio, measurement, angles, area/volume and data.','Select operations for a multistep problem and check the result using estimation or an inverse.'],
 ['JSS 1','Number systems and operations, factors/multiples, fractions, introductory algebra, shapes and data.','Move from a numerical pattern to a simple expression and interpret a chart correctly.'],
 ['JSS 2','Ratio and proportion, percentage applications, equations, angles, polygons and measurement.','Solve a practical comparison problem and justify a geometric calculation.'],
 ['JSS 3','Algebraic consolidation, graphs, geometry/mensuration, statistics and probability at school-required depth.','Work through an unfamiliar mixed problem, explain steps and identify remaining SS1 prerequisites.'],
])
h2('Suggested annual pattern')
para('Use 36 taught weeks per school year: 1-12 number and foundational algebra; 13-24 algebra and measurement/geometry; 25-32 data, chance and connected applications; 33-36 cumulative review. Teach shape and data throughout the year and adjust ordering to the school\'s term scheme.')
h2('Local applications')
para('Use familiar prices, travel times, water capacity, building dimensions and school survey data. State the currency and units in every task. Invite the learner to estimate before calculating and explain whether the answer is practical.')
note('<b>Curriculum transition:</b> NERDC has published revised curriculum materials. This is a proposed bridge, not a verified reproduction of every new grade-level requirement. Obtain the school\'s current scheme before teaching or preparing for BECE or another named assessment.')

# 16
page('08 / WAEC & NECO','General Mathematics: SS1-SS2','A proposed two-year teaching sequence before final-year consolidation. Use a separate content checklist for WAEC and NECO. Current syllabus documents and the school scheme control exact placement and inclusion. [S9-S12]')
table(['Block','Suggested topic grouping','Measurable outcome'],[
 ['SS1 T1','Number bases, modular arithmetic where required, indices/logarithms, approximation and commercial arithmetic.','Use notation correctly and solve a numerical application with a sensible degree of accuracy.'],
 ['SS1 T2','Sets, variation, expressions, linear/quadratic equations and simultaneous relationships.','Translate a context into algebra, solve and verify the result.'],
 ['SS1 T3','Angle reasoning, constructions, plane mensuration and data presentation.','Produce an accurate construction or diagram and interpret a data summary.'],
 ['SS2 T1','Surds and algebraic consolidation; inequalities, sequences/series and graphs.','Recognise structure, form a rule and connect algebraic and graphical solutions.'],
 ['SS2 T2','Trigonometry, bearings, circle geometry, similarity and solid mensuration.','Choose a geometric/trigonometric relationship and present a connected solution with units.'],
 ['SS2 T3','Statistics, probability and integrated applications; school-required additions.','Compare distributions, reason about chance and justify conclusions.'],
])
h2('A 12-week term structure')
para('<b>Weeks 1-3:</b> prerequisite repair and first concepts. <b>4-6:</b> connected methods and guided applications. <b>7-9:</b> independent mixed problems. <b>10:</b> cumulative assessment. <b>11:</b> targeted reteaching. <b>12:</b> a fresh transfer task and term reflection. Move topics between terms to match school coverage.')
h2('Coverage sweep before SS3')
para('Check the actual syllabus for logical reasoning, coordinate geometry, latitude/longitude applications, matrices/transformations, vectors, introductory calculus or other items beyond the common core above. Add only the required content, with explicit teaching time. These items must not be silently omitted or assumed common to both examinations.')
note('<b>Qualification boundary:</b> this route is General Mathematics. Further Mathematics requires its own curriculum and tutor match. Official WAEC examiner materials support the expected standard; they are not a complete substitute for a current syllabus.')

# 17
page('08 / WAEC & NECO','General Mathematics: SS3','A proposed final-year plan. If the examination falls before week 36, work backwards from the actual sitting and bring revision checkpoints forward. [S11-S12]')
table(['Weeks','Focus','Required evidence'],[
 ['1-6','Close confirmed syllabus gaps; strengthen number, logarithms and commercial applications.','A completed WAEC checklist and/or NECO checklist, with unresolved topics scheduled.'],
 ['7-12','Algebra, equations, sequences, graphs and syllabus-specific advanced items.','Independent multistep solutions with substitutions and checks shown.'],
 ['13-18','Geometry, constructions, mensuration, trigonometry and required coordinate/vector topics.','Accurate diagrams, correct units and justified geometric relationships.'],
 ['19-24','Statistics, probability, logical reasoning where required and integrated applications.','Correct interpretation and clear communication of evidence.'],
 ['25-30','Timed objective and written-response practice; complete-paper diagnosis and reteaching.','A record of accuracy, working, question choice where applicable and error causes.'],
 ['31-36','Final mocks, fresh targeted questions and retention checks.','Consistent independent performance and an individual final revision plan.'],
])
h2('Assessment and examination habits')
para('Use the correct board and session materials. Practise the current instructions, permitted resources and required response style. Teach learners to copy figures carefully, state formulae when helpful, preserve units and accuracy, and show enough working for a reader to follow the method.')
para('After each assessment, prioritise the three largest causes of lost marks. A correction includes an explanation and a new independent question, not just a copied solution. Use WAEC Chief Examiners\' observations to select recurring weaknesses for practice.')
note('<b>Verification limit:</b> a current, complete NECO Mathematics syllabus was not available in the retrieved official web material. The NECO plan therefore remains a proposed framework pending the school/board syllabus. No paper timings, question counts or grade boundaries are asserted here.')
para('<b>Suggested final task:</b> solve a mixed problem combining a cost model, a scaled diagram and a probability statement; then audit the solution for assumptions, units, diagrams and numerical accuracy.','small')

# 18
page('09 / Canadian provincial mathematics','Canada: elementary support','Canadian mathematics is province/territory specific. This is an adaptable framework, using Ontario and British Columbia as examples; it is not a national curriculum or a claim of complete provincial coverage. Suitable tutor availability must be confirmed. [S13-S15]')
table(['Stage','Suggested teaching priorities','Evidence of learning'],[
 ['Early elementary','Number relationships, operations, patterns, shape, measurement and simple data.','Use objects/drawings to solve a familiar problem and explain the representation.'],
 ['Middle elementary','Multiplication/division, fractions/decimals, patterns, geometry, measurement and data.','Compare strategies and justify a quantitative or spatial conclusion.'],
 ['Upper elementary','Rational numbers, proportional reasoning, algebraic thinking, spatial reasoning, chance and data.','Model a multistep situation, explain choices and evaluate whether a result is reasonable.'],
 ['Across stages','Reasoning, communication, problem-solving, technology and locally required financial applications.','Present a solution that a reader can follow, with appropriate units and a check.'],
])
h2('Ontario example')
para('Plan across Number, Algebra, Data, Spatial Sense and Financial Literacy, integrating mathematical processes and social-emotional learning. Include the required coding and modelling expectations at the learner\'s grade. Retrieve the exact expectation codes before preparing a unit. [S13]')
h2('British Columbia example')
para('Use the province\'s grade-specific Big Ideas, Curricular Competencies and Content together. A learner should reason, solve, communicate and connect mathematics while developing the relevant content. Use the official grade page to identify local expectations and contexts. [S15]')
h2('Suggested 36-week structure')
para('Weeks 1-12: number/operations and regular spatial work. Weeks 13-24: fractions, patterns and grade-level algebra. Weeks 25-32: data, chance, financial and integrated applications. Weeks 33-36: investigation, review and transition. Weave provincial processes and grade-specific requirements through each block.')

# 19
page('09 / Canadian provincial mathematics','Canada: secondary routes','Start from the exact province, grade and course code. Two learners of the same age may be following courses with different destinations and content.')
table(['Route','Proposed teaching focus','Exit evidence'],[
 ['Early secondary','Number, algebraic relationships, linear/nonlinear models, geometry, measurement and data at course depth.','Translate between representations and justify a model or geometric method.'],
 ['Functions / precalculus','Polynomial, rational, exponential, logarithmic and trigonometric relationships where prescribed.','Analyse domain/range and transformations; interpret solutions and restrictions.'],
 ['Data / foundations','Data collection, probability, statistical reasoning, financial mathematics and applied models as required.','Evaluate a claim, explain assumptions and communicate a practical recommendation.'],
 ['Calculus route','Limits, derivatives, applications and required integral content, only where the selected course includes them.','Connect change and accumulation to graphs, symbols and applications.'],
 ['Workplace / applied route','Measurement, numeracy, rates, finance and practical problem-solving at the selected course level.','Plan a practical task, estimate costs and check compliance with numerical constraints.'],
])
h2('Province examples, not interchangeable courses')
para('<b>Ontario:</b> Grade 9 MTH1W has its own official course requirements. Later courses must be planned from their named codes and current curriculum documents. <b>B.C.:</b> the official catalogue distinguishes routes such as Foundations of Mathematics and Pre-calculus 10, Workplace Mathematics 10, later Pre-calculus, Foundations and Calculus courses. [S14-S15]')
h2('Semester or full-year pacing')
para('Identify the number of taught weeks and divide the school course into six blocks: prerequisites; first major strand; second strand; connected applications; cumulative assessment; targeted repair. For a 36-week plan, start with six weeks each. For a semester course, shorten blocks to the actual calendar without assuming all learners can accelerate equally.')
note('<b>Other provinces/territories:</b> obtain the official course document and build a local expectation-to-unit map before promising coverage. Add or remove topics to fit that document. Ontario and B.C. examples do not establish alignment for Alberta, Quebec or any other jurisdiction.')

# 20
page('10 / International Baccalaureate','IB: primary and middle years','IB support requires confirmation of a suitable tutor and the learner\'s school programme. The tutoring plans below support the school\'s mathematical learning; they do not constitute delivery of an authorised IB programme. MYP framework reference: [S16].')
table(['Stage','Proposed tutoring content','Proposed performance task'],[
 ['PYP support','Develop number, patterns, shape, measurement and data through age-appropriate questions linked to the school\'s unit of inquiry.','Investigate a classroom or community question; represent quantities, record data and explain a mathematical choice.'],
 ['MYP 1-3','Build the four branches: number; algebra; geometry/trigonometry; statistics/probability, with growing independence.','Find a pattern, propose a rule, test it using new cases and explain its limits.'],
 ['MYP 4-5 standard','Consolidate formal methods and connect representations in the school\'s chosen sequence.','Compare models or designs, select a method and evaluate the solution in its real context.'],
 ['MYP 4-5 extended','Deepen algebraic, functional, geometric and statistical reasoning where included in the school course.','Generalise a relationship, justify it mathematically and apply it to an unfamiliar problem.'],
])
h2('Suggested MYP year structure')
para('Use six six-week units, each integrating content and inquiry: numerical relationships; patterns/algebra; space and measurement; functions/models; data/chance; a connected investigation and review. Increase depth across years and align the unit contexts, concepts and criteria with the school\'s plan.')
h2('Assess more than an answer')
para('Gather evidence of knowing and understanding, investigating patterns, communicating, and applying mathematics in real-life contexts. Use the school\'s current criterion descriptors for formal MYP judgements; the general BeyondClass mastery target is only a tutoring measure.')
note('<b>Transition to DP:</b> check algebraic fluency, functions, trigonometry, statistics and technology skills, then identify the chosen AA/AI and SL/HL route. Do not assume every MYP learner needs the same DP bridge.')

# 21
page('10 / IB Diploma mathematics','IB DP: four distinct routes','Choose Mathematics: analysis and approaches (AA) or Mathematics: applications and interpretation (AI), at Standard Level (SL) or Higher Level (HL). This page gives a planning overview; use the assessment-year guide for a complete content map. [S17-S19]')
table(['Route','Teaching emphasis','Evidence / suggested application'],[
 ['AA SL','Symbolic methods, functions, reasoning and calculus, alongside the required geometry and statistics.','Develop and explain a mathematical argument, then interpret a result using a suitable representation.'],
 ['AA HL','AA foundations with greater depth, abstraction and HL-specific content from the guide.','Connect several ideas in an unfamiliar problem and justify a generalisation or method.'],
 ['AI SL','Modelling, interpretation, statistics, technology and applications across the required topic areas.','Choose a model for contextual data, explain assumptions and evaluate its usefulness.'],
 ['AI HL','AI foundations with deeper modelling, technology and route-specific HL techniques.','Compare competing models, analyse limitations and communicate a defensible conclusion.'],
])
h2('Common organising areas')
para('Structure the detailed map around number and algebra, functions, geometry and trigonometry, statistics and probability, and calculus. Content and depth differ across the four routes; a common heading does not mean an identical syllabus. [S18-S19]')
h2('Differentiation in practice')
para('An AA lesson might develop an exact symbolic relationship and connect it to a graph. An AI lesson might start from data, fit a model with technology and interpret parameters. SL tasks prioritise the prescribed level; HL tasks add only the route\'s specified content and demand.')
note('<b>Assessment-year check:</b> current DP courses and the revised courses for first assessment in 2029 must be kept separate. Record the assessment session on every learner plan before choosing content, resources or exploration guidance. [S17-S20]')

# 22
page('10 / IB Diploma mathematics','IB DP: teaching sequence','A proposed two-year tutoring structure. The school guide, route and assessment session determine content; these blocks are not official IB teaching-hour allocations.')
table(['Year / weeks','Suggested focus','Evidence to collect'],[
 ['DP1 1-12','Diagnostic bridge; route-appropriate number/algebra and functions; technology habits.','A secure prerequisite profile, linked representations and a short contextual or symbolic investigation.'],
 ['DP1 13-24','Geometry/trigonometry and required functions, with recurring algebra and model interpretation.','An unfamiliar multistep solution showing method choice and interpretation.'],
 ['DP1 25-36','Statistics/probability and introductory calculus at route depth; exploration of possible questions.','A cumulative check and a learner-generated mathematical question with feasible methods.'],
 ['DP2 1-12','Deeper calculus and remaining route-specific SL/HL content.','A content checklist identifying any remaining gaps; independent reasoning at the selected level.'],
 ['DP2 13-24','Integrate remaining topics; refine investigation skills and interpret technology outputs.','Coherent mathematical communication, reflection and accurate contextual conclusions.'],
 ['DP2 25-36','Session-specific exam practice, targeted reteaching and final retention checks.','Independent timed performance, followed by a focused individual revision plan.'],
])
h2('Exploration support')
para('Help the learner clarify a question, identify accessible mathematics, test assumptions and reflect on results. Keep the investigation and writing learner-owned. Follow the school\'s current guidance and feedback limits, using the correct criteria for the assessment session.')
h2('2027 intake and 2029 first assessment')
para('IB states that revised AA/AI curricula begin teaching in 2027, with first assessment in 2029; the current courses have their final assessment in November 2028. Create a separate revised-course checklist rather than carrying the present content map forward unchanged. Verify route-specific changes and assessment guidance from IB before teaching that intake. [S17, S20]')
note('<b>Resource rule:</b> label every topic checklist, practice set and exploration support document with AA/AI, SL/HL and the assessment session. This prevents an otherwise suitable resource from being used for the wrong course version.')

# 23
page('11 / Reusable tutor resource','Individual learning plan','Complete at entry, update at each cumulative review and share an accessible version with the family. Use an additional sheet when a full topic-by-topic board map is needed.')
table(['Field','Record'],[
 ['Learner / start date','________________________________________________________'],
 ['Grade / school / jurisdiction','________________________________________________________'],
 ['Board / qualification code','________________________________________________________'],
 ['Tier or route / exam session','________________________________________________________'],
 ['Official syllabus version','________________________________________________________'],
 ['School sequence / key dates','________________________________________________________'],
 ['Baseline strengths / gaps','________________________________________________________'],
 ['Access needs / useful strategies','________________________________________________________'],
 ['Goal 1 / evidence / review date','________________________________________________________'],
 ['Goal 2 / evidence / review date','________________________________________________________'],
 ['Lessons / independent practice','________________________________________________________'],
], [WIDTH*.38,WIDTH*.62])
h2('Unit and progress record')
table(['Unit / official code','Evidence and next step','Review date'],[
 ['____________________','______________________________','____________'],
 ['____________________','______________________________','____________'],
 ['____________________','______________________________','____________'],
], [WIDTH*.31,WIDTH*.49,WIDTH*.20])
para('<b>Weekly update:</b> we learned ________; the learner can now ________; the next focus is ________; independent practice is ________.','small')
note('<b>Review decision:</b> record whether to proceed, revisit, extend or change pace, with the evidence behind that choice. Keep official exam grades separate from internal mastery judgements.')

# 24
page('12 / References','Sources: core pathways','Official references checked on 16 October 2026. Bracketed identifiers connect the teaching framework to sources. The sequences, tasks, pacing and internal mastery rules are original proposals.')
sources1=[
 ('S1','Department for Education: mathematics programmes of study, England','https://www.gov.uk/government/publications/national-curriculum-in-england-mathematics-programmes-of-study','Primary and lower-secondary reference; applies to England.'),
 ('S2','Department for Education: GCSE Mathematics subject content','https://www.gov.uk/government/publications/gcse-mathematics-subject-content-and-assessment-objectives','GCSE content baseline; the current named board specification remains necessary.'),
 ('S3','Department for Education: AS and A Level Mathematics','https://www.gov.uk/government/publications/gce-as-and-a-level-mathematics','England subject content reference, including pure and applied mathematics.'),
 ('S4','AQA: A Level Mathematics 7357, subject content','https://www.aqa.org.uk/subjects/mathematics/a-level/mathematics-7357/specification/subject-content','Official board example used to check the breadth of A Level content.'),
 ('S5','Common Core State Standards Initiative: Mathematics standards','https://corestandards.org/mathematics-standards/','Grade and high-school structure; local state adoption must be checked.'),
 ('S6','College Board: SAT content domains','https://satsuite.collegeboard.org/higher-ed-professionals/sat-validity/content-domains','The four mathematics domains and their broad skill coverage.'),
 ('S7','College Board: SAT Math overview','https://satsuite.collegeboard.org/sat/whats-on-the-test/math/overview','Digital modules and links to official practice tools.'),
 ('S8','College Board: How long does the SAT take?','https://blog.collegeboard.org/how-long-does-the-sat-take','Current section question count and time; confirm test-day arrangements.'),
 ('S9','NERDC: official curriculum portal and revised materials','https://www.nerdc.gov.ng/','Curriculum authority and notice of revised basic/senior-secondary materials.'),
 ('S10','NERDC: e-Curriculum General Mathematics view','https://www.nerdc.org.ng/CurriculumView.aspx','Published topic themes; not treated as a complete verification of the latest revision.'),
]
def source_entries(entries):
    for code,title,url,desc in entries:
        para(f'<b>[{code}] {escape(title)}</b><br/>{escape(desc)}','small')
        para(f'<link href="{escape(url)}" color="#32383E">{escape(url)}</link>','small')
        story.append(Spacer(1,3))
source_entries(sources1)

# 25
page('12 / References','Sources: regional and IB routes','Use these references alongside the learner\'s actual course documents. Broad curriculum pages establish the route, but do not replace a complete current content checklist.')
sources2=[
 ('S11','WAEC: official General Mathematics e-Learning / examiner materials','https://www.waeconline.org.ng/e-Learning/Mathematics/mathsmain.html','Expected standards and examiner feedback; obtain the current complete syllabus separately.'),
 ('S12','NECO: official examinations information','https://neco.gov.ng/exams','Authority reference only; a complete current mathematics syllabus was not retrieved.'),
 ('S13','Ontario: elementary mathematics strands','https://www.dcp.edu.gov.on.ca/en/curriculum/elementary-mathematics/grades/g2-math/context/the-strands-in-the-mathematics-curriculum','Official strand organisation. Detailed expectations remain grade specific.'),
 ('S14','Ontario: Grade 9 Mathematics MTH1W, information for parents','https://www.dcp.edu.gov.on.ca/en/curriculum/secondary-mathematics/courses/mth1w/information-for-parents','Example of a named provincial secondary course.'),
 ('S15','British Columbia: Mathematics curriculum','https://curriculum.gov.bc.ca/curriculum/mathematics','Grade and course catalogue, content and competencies.'),
 ('S16','IB: Mathematics in the MYP','https://ibo.org/programmes/middle-years-programme/curriculum/mathematics/','Four mathematical branches; school sequencing and criteria still govern.'),
 ('S17','IB: Mathematics in the Diploma Programme','https://ibo.org/programmes/diploma-programme/curriculum/mathematics/','AA/AI, SL/HL, current course briefs and curriculum transition dates.'),
 ('S18','IB: Mathematics analysis and approaches guide','https://www.ibo.org/globalassets/new-structure/university-admission/pdfs/subject-guides/mathematics-analysis-approaches-guide.pdf','Current-course content reference; check assessment-year applicability.'),
 ('S19','IB: Mathematics applications and interpretation guide','https://www.ibo.org/globalassets/new-structure/university-admission/pdfs/subject-guides/mathematics-applications-interpretation-guide.pdf','Current-course content reference; check assessment-year applicability.'),
 ('S20','IB: analysis and approaches curriculum updates','https://ibo.org/university-admission/latest-curriculum-updates/dp-mathematics-analysis-and-approaches-updates/','2027 first teaching and 2029 first assessment; follow links for revised subject briefs.'),
]
source_entries(sources2)
para('<b>Programme scope:</b> BeyondClass local website materials, including the booking curriculum list and FAQ, reviewed 16 October 2026. They list GCSE, A Level, Common Core, SAT prep, WAEC/NECO, Canadian provincial and IB requests, with tutor matching confirmed before booking. Public site: <link href="https://beyondclassmath.netlify.app/faq.html">beyondclassmath.netlify.app/faq.html</link>.','small')

def decorate(c,doc):
    c.saveState()
    c.setFillColor(INK)
    c.rect(0,H-11,W,11,fill=1,stroke=0)
    c.setFont('BC-Bold',9)
    c.drawString(44,H-36,'BeyondClass Math')
    c.setFillColor(GRAY)
    c.setFont('BC',7.5)
    c.drawRightString(W-44,H-36,'CURRICULUM & SCHEMES OF WORK')
    c.setStrokeColor(LINE)
    c.line(44,44,W-44,44)
    c.setFont('BC',7)
    c.drawString(44,29,'Proposed teaching framework | Edition 1.0 | October 2026')
    c.drawRightString(W-44,29,f'{doc.page} / 25')
    c.restoreState()

doc=SimpleDocTemplate(str(PDF),pagesize=A4,rightMargin=44,leftMargin=44,topMargin=65,bottomMargin=57,
    title='BeyondClass Mathematics Curriculum and Schemes of Work',author='Prepared for BeyondClass Math',
    subject='Proposed mathematics curriculum across all listed BeyondClass pathways')
doc.build(story,onFirstPage=decorate,onLaterPages=decorate)
reader=PdfReader(PDF)
print(f'OUTPUT: {PDF}')
print(f'PAGES: {len(reader.pages)}')
for i,pg in enumerate(reader.pages,1):
    txt=pg.extract_text()
    print(f'{i:02}: {len(txt.split())} words | {txt.splitlines()[0]}')
assert len(reader.pages)==25, f'Expected 25 pages, got {len(reader.pages)}'
