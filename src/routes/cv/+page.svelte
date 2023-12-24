<script>
	import Intro from '$lib/Intro.svelte';
	import Links from '$lib/Links.svelte';
	import Social from '$lib/Social.svelte';

	export let data;
</script>

<div id="container">
	<main>
		<table>
			<tr>
				<th class="date" />
				<th class="intro">
					<h3 id="name">
						<span class="color">Ángel&nbsp;</span>
						<span class="color red">Alex</span>
						<span class="color">ander&nbsp;</span>
						<span class="color red">Cabrera</span>
					</h3>

					<Intro />
					<Social home={false} />
				</th>
			</tr>
			<!-- EDUCATION -->
			<tr>
				<th class="date" />
				<th>
					<h4 class="header">Education</h4>
				</th>
			</tr>
			<tr class="item">
				<th class="date">2019 - Present</th>
				<th>
					<div style="display: flex; align-items: center;">
						<h5>Ph.D. in Human-Computer Interaction (HCI)</h5>
						<h6 style="margin-bottom: 0px; margin-left: 10px">Carnegie Mellon University</h6>
					</div>
					<p>
						Advised by
						<a href="http://perer.org">Adam Perer</a>
						and
						<a href="http://www.cs.cmu.edu/~jasonh/">Jason Hong.</a>
					</p>
				</th>
			</tr>
			<tr class="buffer" />
			<tr class="item">
				<th class="date">2022</th>
				<th>
					<div style="display: flex; align-items: center;">
						<h5>M.S. in Human-Computer Interaction</h5>
						<h6 style="margin-bottom: 0px; margin-left: 10px">Carnegie Mellon University</h6>
					</div>
				</th>
			</tr>
			<tr class="buffer" />
			<tr class="item">
				<th class="date">2019</th>
				<th>
					<div style="display: flex; align-items: center;">
						<h5>B.S. in Computer Science</h5>
						<h6 style="margin-bottom: 0px; margin-left: 10px">Georgia Institute of Technology</h6>
					</div>
					<p>Concentration in intelligence and modeling/simulation. Minor in economics.</p>
				</th>
			</tr>
			<tr class="item">
				<th class="date">Fall 2017</th>
				<th>
					<h6>Sciences Po - Paris, France</h6>
					<p>Exchange program with a focus on economics and political science.</p>
				</th>
			</tr>
			<!-- INDUSTRY -->
			<tr>
				<th class="date" />
				<th>
					<h4 class="header">Work Experience</h4>
				</th>
			</tr>
			<tr class="item">
				<th class="date">Summer 2021</th>
				<th>
					<div style="display: flex; align-items: center;">
						<h5>Apple AI/ML</h5>
						<h6 style="margin-bottom: 0px; margin-left: 10px">Research Intern</h6>
					</div>
					<p>
						Modular machine learning interfaces, see <a href="/paper/symphony">Symphony</a>.
					</p>
				</th>
			</tr>
			<tr class="buffer" />
			<tr class="item">
				<th class="date">Summer 2020</th>
				<th>
					<div style="display: flex; align-items: center;">
						<h5>Microsoft Research</h5>
						<h6 style="margin-bottom: 0px; margin-left: 10px">Research Intern</h6>
					</div>
					<p>
						Behavioral model analysis, see <a href="/paper/aiffinity">AIFinnity</a>.
					</p>
				</th>
			</tr>
			<tr class="buffer" />
			<tr class="item">
				<th class="date">Summer 2018</th>
				<th>
					<div style="display: flex; align-items: center;">
						<h5>Google</h5>
						<h6 style="margin-bottom: 0px; margin-left: 10px">Software Engineering Intern</h6>
					</div>
					<p>Automated driver assistance and hyperlocal weather prediction for Android Auto.</p>
				</th>
			</tr>
			<tr class="buffer" />
			<tr class="item">
				<th class="date">Summer 2017</th>
				<th>
					<div style="display: flex; align-items: center;">
						<h5>Google</h5>
						<h6 style="margin-bottom: 0px; margin-left: 10px">Software Engineering Intern</h6>
					</div>
					<p>
						Anomaly detection and regression analysis system for Google's data processing pipelines.
					</p>
				</th>
			</tr>
			<tr class="buffer" />
			<tr class="item">
				<th class="date">Summer 2016</th>
				<th>
					<div style="display: flex; align-items: center;">
						<h5>Google</h5>
						<h6 style="margin-bottom: 0px; margin-left: 10px">Engineering Practicum Intern</h6>
					</div>
					<p>Analytics platform for monitoring and detecting erroneous edits to Google Maps.</p>
				</th>
			</tr>
			<!-- AWARDS -->
			<tr>
				<th class="date" />
				<th>
					<h4 class="header">Awards</h4>
				</th>
			</tr>
			<tr class="item">
				<th class="date">2023</th>
				<th>
					<h5>
						<a
							href="https://foundation.mozilla.org/en/blog/auditing-ai-announcing-the-2023-mozilla-technology-fund-cohort/"
							>Mozilla Technology Fund</a
						>
					</h5>
					<p>
						$50,000 grant to develop <a href="https://zenoml.com">Zeno</a> as an auditing tool for AI.
					</p>
				</th>
			</tr>
			<tr class="buffer" />
			<tr class="item">
				<th class="date">2023</th>
				<th>
					<h5>
						<a href="https://hai.stanford.edu/ai-audit-challenge-2023-finalists"
							>Stanford HAI Audit Challenge</a
						>
					</h5>
					<p>
						<a href="https://zenoml.com">Zeno</a> was a finalist for the HAI challenge for designing
						better AI auditing tools.
					</p>
				</th>
			</tr>
			<tr class="buffer" />
			<tr class="item">
				<th class="date">2019 - 2022</th>
				<th>
					<h5>National Science Foundation Graduate Research Fellowship (NSF GRFP)</h5>
					<p>
						Three-year graduate fellowship for independent research. Full tuition with an annual
						stipend of $34,000.
					</p>
				</th>
			</tr>
			<tr class="buffer" />
			<tr class="item">
				<th class="date">2019</th>
				<th>
					<h5>
						<a
							href="https://foundation.mozilla.org/en/blog/auditing-ai-announcing-the-2023-mozilla-technology-fund-cohort/"
							>Love Family Foundation Scholarship</a
						>
					</h5>
					<p>
						Co-awarded the $10,000 scholarship for the undergraduate with the most outstanding
						scholastic record.
					</p>
				</th>
			</tr>
			<tr class="buffer" />
			<tr class="item">
				<th class="date">2015 - 2019</th>
				<th>
					<div style="display: flex; align-items: center;">
						<h5>Stamps President's Scholar</h5>
						<h6 style="margin-bottom: 0px; margin-left: 10px">
							Georgia Tech and the Stamps Family Charitable Foundation
						</h6>
					</div>
					<p>
						Full ride scholarship with $15,000 in extracurricular funding awarded to 10 incoming
						students.
					</p>
				</th>
			</tr>
			<tr class="buffer" />
			<tr class="item">
				<th class="date">2018</th>
				<th>
					<div style="display: flex; align-items: center;">
						<h5>The Data Open Datathon</h5>
						<h6 style="margin-bottom: 0px; margin-left: 10px">
							Correlation One and Citadel Securities
						</h6>
					</div>
					<p>
						Placed third and won $2,500 for creating a ML system to predict dangerous road areas.
					</p>
				</th>
			</tr>
			<!-- RESEARCH -->
			<!-- <tr>
        <th class="date" />
        <th>
          <h4 class="header">Academic Research Experience</h4>
        </th>
      </tr>
      <tr class="item">
        <th class="date">August 2019 <br /> - Present</th>
        <th>
          <h5>Carnegie Mellon Human Computer Interaction Institute (HCII)</h5>
          <h6>Graduate Research Assistant</h6>
          <div class="tags">
            <a href="https://dig.cmu.edu/">
              <button class='entry-link'>
                <i class="fas fa-globe" />
                CMU Data Interaction Group
              </button>
            </a>
          </div>
        </th>
      </tr>
      <tr class="buffer" />
      <tr class="item">
        <th class="date">January 2018 <br /> - May 2019</th>
        <th>
          <h5>Polo Club of Data Science</h5>
          <h6>Undergraduate Research Assistant</h6>
          <div class="tags">
            <a href="https://poloclub.github.io/">
              <button class='entry-link'> <i class="fas fa-globe" /> Polo Club </button>
            </a>
          </div>
        </th>
      </tr>
      <tr class="buffer" /> -->
			<!-- PUBLICATIONS -->
			<tr>
				<th class="date" />
				<th>
					<h4 class="header">Refereed Publications</h4>
				</th>
			</tr>
			{#each data.pubs as pub, i}
				<tr class="item">
					<th class="date">[{data.pubs.length - i}]</th>
					<th>
						<a href={'/paper/' + pub.id} class="paper-title">
							<h5>{pub.title}</h5>
						</a>

						<h6 class="authors" style="margin-top: 4px;">
							{@html pub.authors
								.map(
									(p) =>
										`<a class='${
											p.name.includes('Ángel Alexander Cabrera') ? 'me-author-cv' : 'author-cv'
										}' href='${p.website ? p.website : 'javascript:void(0);'}'>${p.name}</a>`
								)
								.join(', ')}
						</h6>

						<p>
							<i
								>{pub.venuelong}. {pub.location ? pub.location + ',' : ''}
								{pub.year}.</i
							>
						</p>

						<Links {pub} />
					</th>
				</tr>
				<tr class="buffer" />
			{/each}
			<!-- OTHER PUBS -->
			<tr>
				<th class="date" />
				<th>
					<h4 class="header">Workshops, Demos, Posters, and Preprints</h4>
				</th>
			</tr>
			{#each data.other as pub, i}
				<tr class="item">
					<th class="date">[{data.other.length - i}]</th>
					<th>
						<a href={'/paper/' + pub.id} class="paper-title">
							<h5>{pub.title}</h5>
						</a>

						<h6 class="authors" style="margin-top: 4px;">
							{@html pub.authors
								.map(
									(p) =>
										`<a class='${
											p.name === 'Ángel Alexander Cabrera' ? 'me-author-cv' : 'author-cv'
										}' href='${p.website}'>${p.name}</a>`
								)
								.join(', ')}
						</h6>

						<p>
							<i>{pub.venuelong}. {pub.location}, {pub.year}.</i>
						</p>

						<Links {pub} />
					</th>
				</tr>
				<tr class="buffer" />
			{/each}
			<!-- TALKS -->
			<tr>
				<th class="date" />
				<th>
					<h4 class="header">Talks</h4>
				</th>
			</tr>
			<tr>
				<th class="date">2023</th>
				<th>
					<h5 class="single">
						<a href="https://www.youtube.com/watch?v=fS3taBVKu_c&t=4s">
							Authoring Interactive AI Evaluation Reports with Zeno
						</a>
					</h5>
					<p>LLMs in Production - Part III</p>
				</th>
			</tr>
			<tr>
				<th class="date">2022, 2023</th>
				<th>
					<h5 class="single">
						<a href="https://drive.google.com/file/d/17RzfAFBfxyqwkLTMPCBd8YFPLE55VxVN/view">
							Evaluating Machine Learning
						</a>
					</h5>
					<p>
						CMU 05-618/318: Human-AI Interaction <br /> CMU 10-605/805: ML with Large Datasets
						<br /> CMU 17-634: Applied Machine Learning
					</p>
				</th>
			</tr>
			<tr>
				<th class="date">2022</th>
				<th>
					<h5 class="single">Visualization and Machine Learning</h5>
					<p>CMU 17-428/728: ML and Sensing</p>
				</th>
			</tr>
			<tr>
				<th class="date">2022</th>
				<th>
					<h5 class="single">
						<a href="https://www.cs.cmu.edu/~bam/uicourse/05631fall2022/SSUI-18-large-apps.pdf"
							>Designing Large Web Applications
						</a>
					</h5>
					<p>CMU 05-431/631: Software Structures for User Interfaces (SSUI)</p>
				</th>
			</tr>
			<tr>
				<th class="date">2022</th>
				<th>
					<h5 class="single">
						<a href="https://www.cs.cmu.edu/~bam/uicourse/05631fall2022/SSUI-17-other-toolkits.pdf">
							Modern Web Frameworks
						</a>
					</h5>
					<p>CMU 05-431/631: Software Structures for User Interfaces (SSUI)</p>
				</th>
			</tr>
			<tr>
				<th class="date">2021</th>
				<th>
					<h5 class="single">Ethics in Data Visualization</h5>
					<p>CMU 05-899: Data Visualization</p>
				</th>
			</tr>
			<tr>
				<th class="date">2021</th>
				<th>
					<h5 class="single">
						<a href="https://drive.google.com/file/d/1jNoZoP0JV94Agc97yANifrT4gE4u1qfL/edit"
							>D3 Deep Dive
						</a>
					</h5>
					<p>CMU 05-899: Data Visualization</p>
				</th>
			</tr>
			<tr>
				<th class="date">2021</th>
				<th>
					<h5 class="single">
						<a href="https://youtu.be/fnr9XWvjJHw?t=1082">
							Data Science Widgets with Svelte and Jupyter
						</a>
					</h5>
					<p>Svelte Summit 2021</p>
				</th>
			</tr>
			<!-- TEACHING -->
			<tr>
				<th class="date" />
				<th>
					<h4 class="header">Teaching</h4>
				</th>
			</tr>
			<tr class="item">
				<th class="date">Fall 2022</th>
				<th>
					<div style="display: flex; align-items: center;">
						<a class="paper-title" href="https://www.cs.cmu.edu/~bam/uicourse/05631fall2022/">
							<h5>05-431/631: Software Structures for User Interfaces (SSUI)</h5>
						</a>
						<h6 style="margin-bottom: 0px; margin-left: 10px">
							Graduate Teaching Assistant @ Carnegie Mellon
						</h6>
					</div>
					<p>Teach weekly lab sections, grade tests and homeworks.</p>
				</th>
			</tr>
			<tr class="buffer" />
			<tr class="item">
				<th class="date">Fall 2021</th>
				<th>
					<div style="display: flex; align-items: center;">
						<a class="paper-title" href="https://dig.cmu.edu/courses/2021-fall-datavis.html">
							<h5>05-499:C: Data Visualization</h5>
						</a>
						<h6 style="margin-bottom: 0px; margin-left: 10px">
							Graduate Teaching Assistant @ Carnegie Mellon
						</h6>
					</div>
					<p>
						Taught a D3 course and led an ethics workshop in addition to grading and course
						management.
					</p>
				</th>
			</tr>
			<tr class="buffer" />
			<tr class="item">
				<th class="date">2016 - 2018</th>
				<th>
					<div style="display: flex; align-items: center;">
						<h5>CS1332: Data Structures and Algorithms</h5>
						<h6 style="margin-bottom: 0px; margin-left: 10px">
							Undergraduate Teaching Assistant @ Georgia Tech
						</h6>
					</div>
					<p>
						Taught a weekly recitation, graded tests and homework, and helped create assignments.
					</p>
				</th>
			</tr>
			<!-- <tr class="buffer" />
			<tr class="item">
				<th class="date">Fall 2016</th>
				<th>
					<div style="display: flex; align-items: center;">
						<h5>GT 1000 - First-Year Seminar</h5>
						<h6 style="margin-bottom: 0px; margin-left: 10px">Team Leader @ Georgia Tech</h6>
					</div>
					<p>
						Designed a class curriculum for incoming first years and helped lead a weekly seminar
						class.
					</p>
				</th>
			</tr> -->
			<!-- MENTORING -->
			<tr>
				<th class="date" />
				<th>
					<h4 class="header">Mentoring</h4>
				</th>
			</tr>
			<tr class="item" /><tr class="item">
				<th class="date">Spring 2023 <br />- Present</th>
				<th>
					<div style="display: flex; align-items: center;">
						<h5>
							<a href="https://www.linkedin.com/in/josh-zhou-11501818b/">Josh Zhou</a>
						</h5>
						<h6 style="margin-bottom: 0px; margin-left: 10px">
							B.S. in Computer Science, Carnegie Mellon
						</h6>
					</div>
					<p>Instance tagging for <a href="https://zenoml.com">Zeno</a>.</p>
				</th>
			</tr>
			<br />
			<tr class="item" /><tr class="item">
				<th class="date">Summer 2022 <br />- Present</th>
				<th>
					<div style="display: flex; align-items: center;">
						<h5>
							<a href="https://ericafu.me/">Erica Fu</a>
						</h5>
						<h6 style="margin-bottom: 0px; margin-left: 10px">
							B.S. in Information Systems, Carnegie Mellon
						</h6>
					</div>
					<p>
						UX design for an ML evaluation platform. See <a href="/paper/zeno">Zeno.</a>
					</p>
				</th>
			</tr>
			<br />
			<tr class="item" /><tr class="item">
				<th class="date">Spring 2023 <br /> - Summer 2023</th>
				<th>
					<div style="display: flex; align-items: center;">
						<h5>
							<a href="https://www.linkedin.com/in/yh3stevenhuang/">Steven Huang</a>
						</h5>
						<h6 style="margin-bottom: 0px; margin-left: 10px">
							Research Associate, Carnegie Mellon
						</h6>
					</div>
					<p>Chart builder for <a href="https://zenoml.com">Zeno</a>.</p>
				</th>
			</tr>
			<br />
			<tr class="item" /><tr class="item">
				<th class="date">Fall 2022 <br />- Spring 2023</th>
				<th>
					<div style="display: flex; align-items: center;">
						<h5>
							<a href="https://tianqi-wu.github.io/">Tianqi Wu</a>
						</h5>
						<h6 style="margin-bottom: 0px; margin-left: 10px">
							M.S. in Computer Science, Carnegie Mellon
						</h6>
					</div>
					<p>Interactive slice discovery for <a href="https://zenoml.com">Zeno</a>.</p>
				</th>
			</tr>
			<br />
			<tr class="item" /><tr class="item">
				<th class="date">Summer 2022 <br />- Spring 2023</th>
				<th>
					<div style="display: flex; align-items: center;">
						<h5>
							<a href="https://www.donnybertucci.com/">Donny Bertucci</a>
						</h5>
						<h6 style="margin-bottom: 0px; margin-left: 10px">
							B.S. in Computer Science, Oregon State University. REU at Carnegie Mellon
						</h6>
					</div>
					<p>Interactive model debugging. See <a href="/paper/zeno">Zeno.</a></p>
				</th>
			</tr>
			<br />
			<tr class="item" /><tr class="item">
				<th class="date">Summer 2022</th>
				<th>
					<div style="display: flex; align-items: center;">
						<h5>
							<a href="https://www.linkedin.com/in/kan-sun/">Kan Sun</a>
						</h5>
						<h6 style="margin-bottom: 0px; margin-left: 10px">B.S. in Math, Carnegie Mellon.</h6>
					</div>
					<p>Algorithmic discovery of ML errors.</p>
				</th>
			</tr>
			<!-- <br />
			<tr class="item" /><tr class="item">
				<th class="date">Spring 2021 <br /> - Present</th>
				<th>
					<div style="display: flex; align-items: center;">
						<h5><a href="https://kazijawad.com/">Kazi Jawad</a></h5>
						<h6 style="margin-bottom: 0px; margin-left: 10px">
							B.S. in Statistics and Machine Learning, Carnegie Mellon
						</h6>
					</div>
					<p>Interactive exploration and debugging of image classification models.</p>
				</th>
			</tr> -->
			<br />
			<tr class="item" /><tr class="item">
				<th class="date">Fall 2021 <br /> - Spring 2022</th>
				<th>
					<div style="display: flex; align-items: center;">
						<h5>
							<a href="https://www.linkedin.com/in/epguo/">Emily Guo</a>
						</h5>
						<h6 style="margin-bottom: 0px; margin-left: 10px">
							B.S. in Statistics and Machine Learning, Carnegie Mellon
						</h6>
					</div>
					<p>Improving human-AI interaction with descriptions of model behavior.</p>
				</th>
			</tr>
			<br />
			<tr class="item">
				<th class="date">Spring 2020 <br /> - Spring 2021</th>
				<th>
					<div style="display: flex; align-items: center;">
						<h5>Abraham Druck</h5>
						<h6 style="margin-bottom: 0px; margin-left: 10px">
							B.S. in Mathematical Sciences, Carnegie Mellon. Now: Technology Analyst at Morgan
							Stanely
						</h6>
					</div>
					<p>
						Crowdsourced discovery of ML failures for image captioning. See <a
							href="https://cabreraalex.com/paper/deblinder">Deblinder.</a
						>
					</p>
				</th>
			</tr>
			<br />
			<tr class="item">
				<th class="date">2020</th>
				<th>
					<h5>CMU AI Mentoring Program</h5>
				</th>
			</tr>
			<!-- SERVICE -->
			<tr>
				<th class="date" />
				<th>
					<h4 class="header">Service</h4>
				</th>
			</tr>
			<tr class="item">
				<th class="date" />
				<th>
					<h5>Organizer</h5>
				</th>
			</tr>
			<tr>
				<th class="date">2023</th>
				<th>
					<h5 class="single">
						<a href="https://cscw-user-ai-auditing.github.io/">
							CSCW Workshop on Supporting User Engagement in Testing, Auditing, and Contesting AI
						</a>
					</h5>
				</th>
			</tr>
			<tr class="buffer" />
			<tr class="item">
				<th class="date" />
				<th>
					<h5>Program Committee</h5>
				</th>
			</tr>
			<tr>
				<th class="date">2022 - 2023</th>
				<th>
					<h5 class="single">
						AC, ACM Conference on Human Factors in Computing Systems (CHI) Late Breaking Work
					</h5>
				</th>
			</tr>
			<tr>
				<th class="date">2022 - 2023</th>
				<th>
					<h5 class="single">PC, ACM Fairness, Accountability, and Transparency (FAccT)</h5>
				</th>
			</tr>
			<tr>
				<th class="date">2022 - 2023</th>
				<th>
					<h5 class="single">
						PC, IEEE VIS Workshop on Visualization for AI Explainability (VISxAI)
					</h5>
				</th>
			</tr>
			<tr>
				<th class="date">2023</th>
				<th>
					<h5 class="single">
						PC, CHI Workshop on Trust and Reliance in AI-Assisted Tasks (TRAIT)
					</h5>
				</th>
			</tr>
			<tr>
				<th class="date">2022</th>
				<th>
					<h5 class="single">
						AC, ACM Conference on Computer-Supported Cooperative Work and Social Computing (CSCW)
						Posters
					</h5>
				</th>
			</tr>
			<tr class="buffer" />
			<tr class="item">
				<th class="date" />
				<th>
					<h5>Reviewer</h5>
				</th>
			</tr>
			<tr>
				<th class="date">2021 - 2024</th>
				<th>
					<h5 class="single">ACM Conference on Human Factors in Computing Systems (CHI)</h5>
				</th>
			</tr>
			<tr>
				<th class="date">2021 - 2023</th>
				<th>
					<h5 class="single">
						ACM Conference on Computer-Supported Cooperative Work and Social Computing (CSCW)
					</h5>
				</th>
			</tr>
			<tr>
				<th class="date">2020 - 2023</th>
				<th>
					<h5 class="single">IEEE VIS</h5>
				</th>
			</tr>
			<tr>
				<th class="date">2022 - 2023</th>
				<th>
					<h5 class="single">ACM Fairness, Accountability, and Transparency (FAccT)</h5>
				</th>
			</tr>
			<tr>
				<th class="date">2022</th>
				<th>
					<h5 class="single">ACM Symposium on User Interface Software and Technology (UIST)</h5>
				</th>
			</tr>
			<tr>
				<th class="date">2022</th>
				<th>
					<h5 class="single">IEEE Computer Graphics and Applications (CGASI)</h5>
				</th>
			</tr>
			<tr>
				<th class="date">2019 - 2021</th>
				<th>
					<h5 class="single">IEEE Transactions on Visualization and Computer Graphics (TVCG)</h5>
				</th>
			</tr>
			<tr>
				<th class="date">2019</th>
				<th>
					<h5 class="single">ACM Transactions on Interactive Intelligent Systems (TiiS)</h5>
				</th>
			</tr>
			<tr class="buffer" />
			<tr class="item">
				<th class="date" />
				<th>
					<h5>Student Volunteer</h5>
				</th>
			</tr>
			<tr>
				<th class="date">2019</th>
				<th>
					<h5 class="single">IEEE VIS</h5>
				</th>
			</tr>
			<tr>
				<th class="date">2019</th>
				<th>
					<h5 class="single">ACM Fairness, Accountability, and Transparency (FAccT)</h5>
				</th>
			</tr>
			<tr class="buffer" />
			<tr class="item">
				<th class="date" />
				<th>
					<h5>Department</h5>
				</th>
			</tr>
			<tr>
				<th class="date">2022 - 2023</th>
				<th>
					<h5 class="single">REU application reviewer</h5>
				</th>
			</tr>
			<tr>
				<th class="date">2020 - 2021</th>
				<th>
					<h5 class="single">Ph.D. student faculty representative</h5>
				</th>
			</tr>
			<!-- PRESS -->
			<tr>
				<th class="date" />
				<th>
					<h4 class="header">Press</h4>
				</th>
			</tr>
			<tr>
				<th class="date">2023</th>
				<th>
					<h5 class="single">
						<a
							href="https://venturebeat.com/ai/google-gemini-is-not-even-as-good-as-gpt-3-5-turbo-researchers-find/"
						>
							"Google Gemini is not even as good as GPT-3.5 Turbo, researchers find"
						</a>
						-
						<i>Venture Beat</i>
					</h5>
				</th>
			</tr>
			<tr>
				<th class="date">2023</th>
				<th>
					<h5 class="single">
						<a
							href="https://foundation.mozilla.org/en/blog/auditing-ai-announcing-the-2023-mozilla-technology-fund-cohort/"
						>
							"Auditing AI: Announcing the 2023 Mozilla Technology Fund Cohort"
						</a>
						-
						<i>Mozilla</i>
					</h5>
				</th>
			</tr>
			<tr>
				<th class="date">2020</th>
				<th>
					<h5 class="single">
						<a
							href="https://www.cnn.com/us/live-news/us-coronavirus-update-04-23-20/h_473c68f3d0cea263896b85e12aec7d13"
						>
							"New forecasting data could help public health officials prepare for what's next in
							the coronavirus pandemic"
						</a>
						-
						<i>CNN</i>
					</h5>
				</th>
			</tr>
			<tr>
				<th class="date">2020</th>
				<th>
					<h5 class="single">
						<a
							href="https://www.wired.com/story/survey-data-facebook-google-map-covid-19-carnegie-mellon/"
						>
							"Facebook and Google Survey Data May Help Map Covid-19's Spread"
						</a>
						-
						<i>Wired</i>
					</h5>
				</th>
			</tr>
			<tr>
				<th class="date">2020</th>
				<th>
					<h5 class="single">
						<a
							href="https://www.cmu.edu/news/stories/archives/2020/april/cmu-unveils-covidcast-maps.html"
						>
							"Carnegie Mellon Unveils Five Interactive COVID-19 Maps"
						</a>
						-
						<i>Carnegie Mellon</i>
					</h5>
				</th>
			</tr>
			<tr>
				<th class="date">2020</th>
				<th>
					<h5 class="single">
						<a
							href="https://datastori.es/156-fairness-in-machine-learning-with-yongsu-ahn-and-alex-cabrera/"
						>
							"Visualizing Fairness in Machine Learning"
						</a>
						-
						<i>Data Stories Podcast</i>
					</h5>
				</th>
			</tr>
			<tr>
				<th class="date">2019</th>
				<th>
					<h5 class="single">
						<a
							href="https://www.scs.gatech.edu/news/620748/college-computing-student-alex-cabrera-wins-love-family-foundation-scholarship"
						>
							"Alex Cabrera Wins Love Family Foundation Scholarship"
						</a>
						-
						<i>GT SCS</i>
					</h5>
				</th>
			</tr>
			<tr>
				<th class="date">2019</th>
				<th>
					<h5 class="single">
						<a
							href="https://www.news.gatech.edu/2019/06/25/georgia-tech-satellite-successfully-launched-space"
						>
							"Georgia Tech Satellite Successfully Launched Into Space "
						</a>
						-
						<i>Georgia Tech</i>
					</h5>
				</th>
			</tr>
			<tr>
				<th class="date">2018</th>
				<th>
					<h5 class="single">
						<a
							href="https://www.cc.gatech.edu/news/602004/datathon-challenges-students-create-solutions-real-world-problems"
						>
							"Datathon Challenges Students to Create Solutions to Real-World Problems"
						</a>
						-
						<i>GT SCS</i>
					</h5>
				</th>
			</tr>
			<!-- PROJECTS -->
			<tr>
				<th class="date" />
				<th>
					<h4 class="header">Projects and Open Source</h4>
				</th>
			</tr>
			<tr class="item">
				<th class="date">2023</th>
				<th>
					<h5>Zeno</h5>
					<p>An interactive ML evaluation framework for any data or model.</p>
					<div class="tags">
						<a href="https://zenoml.com/">
							<button class="entry-link">
								<i class="fas fa-globe" /> Website
							</button>
						</a>
						<a href="https://github.com/zeno-ml/zeno-hub">
							<button class="entry-link">
								<i class="fab fa-github" /> GitHub
							</button>
						</a>
					</div>
				</th>
			</tr>
			<tr class="buffer" />
			<tr class="item">
				<th class="date">2021</th>
				<th>
					<h5>Svelte + Vega</h5>
					<p>A Svelte component for reactively rendering Vega and Vega-Lite visualizations.</p>
					<div class="tags">
						<a href="https://github.com/vega/svelte-vega">
							<button class="entry-link">
								<i class="fab fa-github" /> GitHub
							</button>
						</a>
						<a href="https://vega.github.io/svelte-vega/?path=/story/svelte-vega-vega--demo">
							<button class="entry-link">
								<i class="fas fa-globe" /> Demo
							</button>
						</a>
					</div>
				</th>
			</tr>
			<tr class="buffer" />
			<tr class="item">
				<th class="date">2021</th>
				<th>
					<h5>Svelte + Jupyter Widgets</h5>
					<p>A framework for creating reactive data science widgets using Svelte JS.</p>
					<div class="tags">
						<a
							href="https://cabreraalex.medium.com/creating-reactive-jupyter-widgets-with-svelte-ef2fb580c05"
						>
							<button class="entry-link">
								<i class="fab fa-medium" /> Blog
							</button>
						</a>
						<a href="https://github.com/cabreraalex/widget-svelte-cookiecutter">
							<button class="entry-link">
								<i class="fab fa-github" /> GitHub
							</button>
						</a>
						<a href="https://youtu.be/fnr9XWvjJHw?t=1082">
							<button class="entry-link">
								<i class="fab fa-youtube" /> Video
							</button>
						</a>
					</div>
				</th>
			</tr>
			<tr class="buffer" />
			<tr class="item">
				<th class="date">2020</th>
				<th>
					<h5>COVIDCast Visualization of COVID-19 Indicators</h5>
					<p>
						Interactive visualization system of COVID-19 indicators gathered through >20,000,000
						surveys on Facebook and Google by <a href="https://delphi.cmu.edu/">CMU Delphi</a>.
					</p>
					<div class="tags">
						<a href="https://covidcast.cmu.edu/">
							<button class="entry-link">
								<i class="fas fa-globe" /> Website
							</button>
							<a href="https://github.com/cmu-delphi/www-covidcast">
								<button class="entry-link">
									<i class="fab fa-github" /> GitHub
								</button>
							</a>
						</a>
					</div>
				</th>
			</tr>
			<!-- <tr class="buffer" />
      <tr class="item">
        <th class="date">Fall 2018</th>
        <th>
          <h5>ICLR'19 Reproducibility Challenge</h5>
          <h6>
            Generative Adversarial Models for Learning Private and Fair
            Representations
          </h6>
          <p >
            Implemented and reproduced an ICLR'19 submission using GANs to
            decorrelate sensitive data.
          </p>
          <div class="tags">
            <a href="https://github.com/cabreraalex/private-fair-GAN">
              <button class="entry-link">
                <i class="fab fa-github" /> GitHub
              </button>
            </a>
          </div>
        </th>
      </tr> -->
			<tr class="buffer" />
			<!-- <tr class="item">
        <th class="date">Spring 2018</th>
        <th>
          <h5>Georgia Tech Bus System Analysis</h5>
          <p >
            System that combines Google Maps and graph algorithms to enable
            navigation for GT buses.
          </p>
          <div class="tags">
            <a href="./gt_bus_analysis.pdf">
              <button class="entry-link">
                <i class="fas fa-file-pdf" /> Poster
              </button>
            </a>
            <a href="http://poloclub.gatech.edu/cse6242/2018spring/">
              <button class="entry-link">
                <i class="fas fa-globe" /> Class
              </button>
            </a>
          </div>
        </th>
      </tr>
      <tr class="buffer" /> -->
			<tr class="item">
				<th class="date">2015 - 2017</th>
				<th>
					<div style="display: flex; align-items: center;">
						<h5>PROX-1 Satellite</h5>
						<h6 style="margin-bottom: 0px; margin-left: 10px">
							Flight Software Lead and Researcher
						</h6>
					</div>
					<p>
						Led a team of engineers in developing the software for a fully undergraduate-led
						satellite mission.
					</p>
					<div class="tags">
						<a
							href="https://www.news.gatech.edu/2019/06/25/georgia-tech-satellite-successfully-launched-space"
						>
							<button class="entry-link">
								<i class="fas fa-rocket" /> In space!
							</button>
						</a>
						<a href="https://www.ae.gatech.edu/news/2017/05/prox-1-launch-has-launched">
							<button class="entry-link">
								<i class="far fa-newspaper" /> Press release
							</button>
						</a>
					</div>
				</th>
			</tr>
			<tr class="buffer" />
			<tr class="item">
				<th class="date">2014</th>
				<th>
					<h5>CTF Resources</h5>
					<p>
						Guide and resources for capture the flag (CTF) competitions with over 1.6k stars on
						GitHub.
					</p>
					<div class="tags">
						<a href="http://ctfs.github.io/resources/">
							<button class="entry-link">
								<i class="fas fa-globe" /> Website
							</button>
						</a>
						<a href="https://github.com/ctfs/resources">
							<button class="entry-link">
								<i class="fab fa-github" /> GitHub
							</button>
						</a>
					</div>
				</th>
			</tr>
			<!-- CAMPUS INVOLVEMENT
      <tr>
        <th class="date" />
        <th>
          <h4 class="header">Campus Involvement</h4>
        </th>
      </tr>
      <tr class="item">
        <th class="date">
          September 2015
          <br />
          - April 2017
        </th>
        <th>
          <h5>Stamps Scholars National Convention 2017</h5>
          <h6>Vice-chair of large events</h6>
          <p >
            Directed a 13 person committee in organizing hotels, meals, and
            presentations for over 700 students.
          </p>
          <div class="tags">
            <a href="http://ssnc.stampsfoundation.org/">
              <button class='entry-link'>
                <i class="fas fa-globe" />
                Website
              </button>
            </a>
          </div>
        </th>
      </tr>
      <tr class="buffer" />
      <tr class="item">
        <th class="date">Spring 2016</th>
        <th>
          <h5>Tour Guide</h5>
          <p >
            Led a tour of campus for visiting families every week.
          </p>
          <div class="tags">
            <a href="http://admission.gatech.edu/gttours">
              <button class='entry-link'>
                <i class="fas fa-globe" />
                Website
              </button>
            </a>
          </div>
        </th>
      </tr>
      <tr class="buffer" />
      <tr class="item">
        <th class="date">
          September 2015
          <br />
          - May 2016
        </th>
        <th>
          <h5>Georgia Tech Student Foundation</h5>
          <h6>Investments committee and Freshman Leadership Initiative</h6>
          <p >
            Conducted market research to help manage a $1.2 million endowment
            and organized fundraising events.
          </p>
          <div class="tags">
            <a
              href="http://www.gtsf.gatech.edu/s/1481/alumni/17/home.aspx?sid=1481&gid=42">
              <button class='entry-link'>
                <i class="fas fa-globe" />
                Website
              </button>
            </a>
          </div>
        </th>
      </tr> -->
			<!-- SELECT CLASSES -->
			<tr>
				<th class="date" />
				<th>
					<h4 class="header">Selected Courses</h4>
				</th>
			</tr>
			<tr class="item">
				<th class="date">Ph.D.</th>
				<th>
					<h5 class="single">
						<a href="https://yonatanbisk.com/teaching/mmml-s22/"> MultiModal Machine Learning </a>
					</h5>
					<h5 class="single">Causality and Machine Learning</h5>
					<h5 class="single">Human Judgement and Decision Making</h5>
					<h5 class="single">
						<a href="https://www.hcii.cmu.edu/courses/applied-research-methods">
							Applied Research Methods
						</a>
					</h5>
				</th>
			</tr>
			<tr class="item">
				<th class="date">B.S.</th>
				<th>
					<h5 class="single">
						<a href="https://www.cc.gatech.edu/classes/AY2019/cs7643_fall/"> Deep Learning </a>
					</h5>
					<h5 class="single">
						<a href="http://poloclub.gatech.edu/cse6242/2018spring"> Data and Visual Analytics </a>
					</h5>

					<h5 class="single">
						<a href="https://www.omscs.gatech.edu/cs-7641-machine-learning"> Machine Learning </a>
					</h5>
					<h5 class="single">
						<a href="http://cx4230.gatech.edu/sp17/"> Computer Simulation </a>
					</h5>
					<h5 class="single">Honors Algorithms</h5>
				</th>
			</tr>
			<!-- SKILLS -->
			<!-- <tr>
        <th class="date" />
        <th>
          <h4 class="header">Skills</h4>
        </th>
      </tr>
      <tr class="item">
        <th class="date" />
        <th>
          <h5>Languages</h5>
          <div class="tags">
            <button class='entry-link'>English - Native</button>
            <button class='entry-link'>Spanish - Native</button>
            <button class='entry-link'>French - Conversational (B1)</button>
          </div>
        </th>
      </tr>
      <tr class="buffer" />
      <tr class="item">
        <th class="date" />
        <th>
          <h5>Programming Languages</h5>
          <div class="tags">
            <button class='entry-link'>Python</button>
            <button class='entry-link'>JavaScript</button>
            <button class='entry-link'>TypeScript</button>
            <button class='entry-link'>Java</button>
            <button class='entry-link'>C/C++</button>
            <button class='entry-link'>SQL</button>
            <button class='entry-link'>Go</button>
          </div>
        </th>
      </tr>
      <tr class="buffer" />
      <tr class="item">
        <th class="date" />
        <th>
          <h5>Technologies</h5>
          <div class="tags">
            <button class='entry-link'>Machine Learning</button>
            <button class='entry-link'>Full Stack Development</button>
            <button class='entry-link'>PyTorch</button>
            <button class='entry-link'>D3</button>
            <button class='entry-link'>Vega</button>
            <button class='entry-link'>Svelte</button>
            <button class='entry-link'>React</button>
            <button class='entry-link'>Jupyter Widgets</button>
            <button class='entry-link'>AWS/Azure/Google Cloud</button>
            <button class='entry-link'>Cloud Dataflow/MapReduce</button>
            <button class='entry-link'>Amazon Mechanical Turk</button>
          </div>
        </th>
      </tr>
    -->
			<tr class="buffer" />
			<!-- <tr class="item">
        <th class="date" />
        <th>
          <p >Last updated November 5, 2020.</p>
        </th>
      </tr> -->
		</table>
	</main>
</div>

<style>
	#container {
		max-width: 900px;
		margin: 0px auto;
	}

	main {
		width: 100%;
	}

	table {
		text-align: left;
		padding: 0px;
	}

	h3 {
		font-size: 40px;
	}

	h4 {
		font-size: 20px;
		font-weight: 400;
	}

	h5 a {
		color: black;
	}
	h5 a:hover {
		color: var(--secondary);
	}

	h5 {
		margin: 0px;
		font-size: 16px;
		font-weight: 500;
		line-height: 22px;
		color: black;
	}

	h6 {
		font-size: 14px;
		margin: 0px;
		margin-bottom: 0px;
		margin-bottom: 5px;
		color: rgba(0, 0, 0, 0.5);
		font-weight: 300;
	}

	th {
		padding-bottom: 5px;
	}

	.buffer {
		height: 10px;
	}

	.date {
		width: 135px;
		padding-right: 20px;
		font-weight: 200;
		float: left;
		text-align: right;
		line-height: 22px;
	}

	p {
		color: RGBA(0, 0, 0, 0.7);
		font-size: 16px;
		font-weight: 100;
		line-height: 20px;
	}

	.item {
		margin-top: 5px;
		margin-bottom: 5px;
	}

	main {
		margin: 0px auto;
	}

	.header {
		border-bottom: 1px solid RGBA(0, 0, 0, 0.7);
		padding-bottom: 10px;
		margin-top: 40px;
		margin-bottom: 12px;
		color: var(--secondary);
	}

	.red {
		color: var(--secondary);
	}

	#name {
		margin-bottom: 10px;
		font-size: 0px;
		font-weight: 400;
	}

	.color {
		font-size: 30px;
	}

	.single {
		font-weight: 300;
		margin-bottom: 0px;
	}

	.fas {
		margin-right: 4px;
	}

	.fab {
		margin-right: 4px;
	}

	.far {
		margin-right: 4px;
	}

	:global(.me-author-cv) {
		font-size: 16px;
	}
	:global(.author-cv) {
		font-size: 16px;
		color: rgba(0, 0, 0, 0.6);
	}
</style>
