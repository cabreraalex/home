<script context="module">
	const pubsFeat = [
		'aiffinity',
		'symphony',
		'covidcast',
		'deblinder',
		'expo',
		'confusion',
		'fairvis'
	];
	const otherFeat = ['publics', 'subgroup-gen', 'interactive-classification'];

	import yaml from 'js-yaml';

	export async function load({ fetch }) {
		let pubs = [];
		for (let pub of pubsFeat) {
			pubs.push(
				await fetch('/pubs/' + pub + '.yml')
					.then((r) => r.text())
					.then((d) => yaml.load(d))
			);
		}

		let other = [];
		for (let pub of otherFeat) {
			other.push(
				await fetch('/pubs/' + pub + '.yml')
					.then((r) => r.text())
					.then((d) => yaml.load(d))
			);
		}

		return {
			props: { pubs, other }
		};
	}
</script>

<script>
	import Intro from '$lib/Intro.svelte';
	import Social from '$lib/Social.svelte';
	import Links from '$lib/Links.svelte';
	import { onMount } from 'svelte';

	let mounted = false;
	onMount(() => (mounted = true));

	export let pubs;
	export let other;
</script>

{#if mounted}
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
						<h5>PhD in Human-Computer Interaction (HCI)</h5>
						<h6>Carnegie Mellon University</h6>
						<p class="desc">
							Advised by
							<a href="http://perer.org">Adam Perer</a>
							and
							<a href="http://www.cs.cmu.edu/~jasonh/">Jason Hong.</a>
						</p>
						<div class="tags">
							<a href="https://dig.cmu.edu/">
								<button class="entry-link">
									<i class="fas fa-globe" />
									Data Interaction Group
								</button>
							</a>
						</div>
					</th>
				</tr>
				<tr class="buffer" />
				<tr class="item">
					<th class="date">2019</th>
					<th>
						<h5>B.S. in Computer Science</h5>
						<h6>Georgia Institute of Technology</h6>
						<p class="desc">
							Concentration in intelligence and modeling/simulation.
							<br />
							Minor in economics.
						</p>
					</th>
				</tr>
				<tr class="item">
					<th class="date">Fall 2017</th>
					<th>
						<h6>Sciences Po - Paris, France</h6>
						<p class="desc">Exchange program with a focus on economics and political science.</p>
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
						<h5>Apple AI/ML</h5>
						<h6>Research Intern</h6>
						<p class="desc">
							Modular machine learning interfaces, see <a href="/paper/symphony">Symphony</a>.
						</p>
						<div class="tags">
							<a href="https://machinelearning.apple.com/">
								<button class="entry-link">
									<i class="fas fa-globe" /> Apple AI/ML
								</button>
							</a>
						</div>
					</th>
				</tr>
				<tr class="buffer" />
				<tr class="item">
					<th class="date">Summer 2020</th>
					<th>
						<h5>Microsoft Research</h5>
						<h6>Research Intern</h6>
						<p class="desc">
							Behavioral model analysis, see <a href="/paper/aiffinity">AIFinnity</a>.
						</p>
						<div class="tags">
							<a href="https://www.microsoft.com/en-us/research/group/vida/">
								<button class="entry-link">
									<i class="fas fa-globe" /> VIDA Group
								</button>
							</a>
						</div>
					</th>
				</tr>
				<tr class="buffer" />
				<tr class="item">
					<th class="date">Summer 2018</th>
					<th>
						<h5>Google</h5>
						<h6>Software Engineering Intern</h6>
						<p class="desc">
							Researched and prototyped improvements for automated driver assistance systems and
							hyperlocal weather prediction for the next generation of Android Auto.
						</p>
						<div class="tags">
							<a
								href="https://www.wsj.com/articles/google-to-partner-with-biggest-car-alliance-1537243260
                "
							>
								<button class="entry-link">
									<i class="far fa-newspaper" />
									WSJ Article
								</button>
							</a>
						</div>
					</th>
				</tr>
				<tr class="buffer" />
				<tr class="item">
					<th class="date">Summer 2017</th>
					<th>
						<h5>Google</h5>
						<h6>Software Engineering Intern</h6>
						<p class="desc">
							Created an anomaly detection and trend analysis system for Google's data processing
							pipelines.
						</p>
					</th>
				</tr>
				<tr class="buffer" />
				<tr class="item">
					<th class="date">Summer 2016</th>
					<th>
						<h5>Google</h5>
						<h6>Engineering Practicum Intern</h6>
						<p class="desc">
							Built an analytics platform for monitoring and catching erroneous edits to Google
							Maps.
						</p>
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
					<th class="date">2019 - 2022</th>
					<th>
						<h5>National Science Foundation Graduate Research Fellowship (NSF GRFP)</h5>
						<p class="desc">
							Three-year graduate fellowship for independent research. Full tuition with an annual
							stipend of $34,000.
						</p>
						<div class="tags">
							<a href="https://www.nsfgrfp.org/">
								<button class="entry-link">
									<i class="fas fa-globe" /> Website
								</button>
							</a>
						</div>
					</th>
				</tr>
				<tr class="buffer" />
				<tr class="item">
					<th class="date">2019</th>
					<th>
						<h5>Love Family Foundation Scholarship</h5>
						<p class="desc">
							Co-awarded the $10,000 scholarship for the undergraduate with the most outstanding
							scholastic record.
						</p>
						<div class="tags">
							<a
								href="https://www.scs.gatech.edu/news/620748/college-computing-student-alex-cabrera-wins-love-family-foundation-scholarship"
							>
								<button class="entry-link">
									<i class="fas fa-globe" /> Announcement
								</button>
							</a>
						</div>
					</th>
				</tr>
				<tr class="buffer" />
				<tr class="item">
					<th class="date">2015 - 2019</th>
					<th>
						<h5>Stamps President's Scholar</h5>
						<h6>Georgia Tech and the Stamps Family Charitable Foundation</h6>
						<p class="desc">
							Full ride scholarship with $15,000 in extracurricular funding awarded to 10 incoming
							students.
						</p>
						<div class="tags">
							<a href="https://stampsps.gatech.edu/">
								<button class="entry-link">
									<i class="fas fa-globe" /> Website
								</button>
							</a>
						</div>
					</th>
				</tr>
				<tr class="buffer" />
				<tr class="item">
					<th class="date">2018</th>
					<th>
						<h5>The Data Open Datathon</h5>
						<h6>Correlation One and Citadel Securities</h6>
						<p class="desc">
							Placed third and won $2,500 for creating a ML system to predict dangerous road areas.
						</p>
						<div class="tags">
							<a
								href="https://www.cc.gatech.edu/news/602004/datathon-challenges-students-create-solutions-real-world-problems"
							>
								<button class="entry-link">
									<i class="far fa-newspaper" /> Press Release
								</button>
							</a>
						</div>
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
				{#each pubs as pub, i}
					<tr class="item">
						<th class="date">[{pubs.length - i}]</th>
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

							<p class="desc">
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
				{#each other as pub, i}
					<tr class="item">
						<th class="date">[{other.length - i}]</th>
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

							<p class="desc">
								<i>{pub.venuelong}. {pub.location}, {pub.year}.</i>
							</p>

							<Links {pub} />
						</th>
					</tr>
					<tr class="buffer" />
				{/each}
				<!-- TEACHING -->
				<tr>
					<th class="date" />
					<th>
						<h4 class="header">Teaching</h4>
					</th>
				</tr>
				<tr class="item">
					<th class="date">Fall 2021</th>
					<th>
						<h5>05499:C - Data Visualization</h5>
						<h6>Graduate Teaching Assistant @ Carnegie Mellon</h6>
						<p class="desc">
							Taught a D3 course and led an ethics workshop in addition to grading and course
							management.
						</p>
					</th>
				</tr>
				<tr class="buffer" />
				<tr class="item">
					<th class="date">Fall 2016 <br /> Spring 2017 <br /> Spring 2018</th>
					<th>
						<h5>CS1332 - Data Structures and Algorithms</h5>
						<h6>Undergraduate Teaching Assistant @ Georgia Tech</h6>
						<p class="desc">
							Taught a 1 1/2 hour weekly recitation, graded tests and homework, and helped create
							assignments.
						</p>
					</th>
				</tr>
				<tr class="buffer" />
				<tr class="item">
					<th class="date">Fall 2016</th>
					<th>
						<h5>GT 1000 - First-Year Seminar</h5>
						<h6>Team Leader @ Georgia Tech</h6>
						<p class="desc">
							Designed a class curriculum for incoming first years and helped lead a weekly seminar
							class.
						</p>
					</th>
				</tr>
				<!-- MENTORING -->
				<tr>
					<th class="date" />
					<th>
						<h4 class="header">Mentoring</h4>
					</th>
				</tr>
				<tr class="item" /><tr class="item">
					<th class="date">Summer 2022 - Present</th>
					<th>
						<h5 class="press">
							<a href="https://ericafu.me/">Erica Fu</a>
						</h5>
						<h6>B.S. in Information Systems, Carnegie Mellon</h6>
						<p class="desc">UX design for an ML evaluation platform.</p>
					</th>
				</tr>
				<br />
				<tr class="item" /><tr class="item">
					<th class="date">Summer 2022 - Present</th>
					<th>
						<h5 class="press">
							<a href="https://www.linkedin.com/in/kan-sun/">Kan Sun</a>
						</h5>
						<h6>B.S. in Math, Carnegie Mellon.</h6>
						<p class="desc">Algorithmic discovery of ML errors.</p>
					</th>
				</tr>
				<br />
				<tr class="item" /><tr class="item">
					<th class="date">Summer 2022 - Present</th>
					<th>
						<h5 class="press">
							<a href="https://www.donnybertucci.com/">Donny Bertucci</a>
						</h5>
						<h6>B.S. in Computer Science, Oregon State University. REU at Carnegie Mellon</h6>
						<p class="desc">Interactive model debugging.</p>
					</th>
				</tr>
				<br />
				<tr class="item" /><tr class="item">
					<th class="date">Fall 2021 <br /> - Present</th>
					<th>
						<h5 class="press">
							<a href="https://www.linkedin.com/in/epguo/">Emily Guo</a>
						</h5>
						<h6>B.S. in Statistics and Machine Learning, Carnegie Mellon</h6>
						<p class="desc">Improving human-AI interaction with descriptions of model behavior.</p>
					</th>
				</tr>
				<br />
				<tr class="item" /><tr class="item">
					<th class="date">Spring 2021 <br /> - Present</th>
					<th>
						<h5 class="press"><a href="https://kazijawad.com/">Kazi Jawad</a></h5>
						<h6>B.S. in Statistics and Machine Learning, Carnegie Mellon</h6>
						<p class="desc">
							Interactive exploration and debugging of image classification models.
						</p>
					</th>
				</tr>
				<br />
				<tr class="item">
					<th class="date">Spring 2020 <br /> - Spring 2021</th>
					<th>
						<h5>Abraham Druck</h5>
						<h6>
							B.S. in Mathematical Sciences, Carnegie Mellon. Now: Technology Analyst at Morgan
							Stanely
						</h6>
						<p class="desc">
							Crowdsourced discovery of ML failures for image captioning. See <a
								href="https://cabreraalex.com/paper/deblinder">Deblinder.</a
							>
						</p>
					</th>
				</tr>
				<br />
				<tr class="item">
					<th class="date">Fall 2020 <br /> Spring 2020</th>
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
						<h5>Program Committee</h5>
					</th>
				</tr>
				<tr>
					<th class="date">2022</th>
					<th>
						<h5 class="single">
							AC, ACM Conference on Human Factors in Computing Systems (CHI) Late Breaking Work
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
				<tr>
					<th class="date">2022</th>
					<th>
						<h5 class="single">PC, ACM Fairness, Accountability, and Transparency (FAccT)</h5>
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
					<th class="date">2021 - 2022</th>
					<th>
						<h5 class="single">ACM Conference on Human Factors in Computing Systems (CHI)</h5>
					</th>
				</tr>
				<tr>
					<th class="date">2021 - 2022</th>
					<th>
						<h5 class="single">
							ACM Conference on Computer-Supported Cooperative Work and Social Computing (CSCW)
						</h5>
					</th>
				</tr>
				<tr>
					<th class="date">2020 - 2022</th>
					<th>
						<h5 class="single">IEEE Visualization (VIS)</h5>
					</th>
				</tr>
				<tr>
					<th class="date">2022</th>
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
						<h5 class="single">IEEE Visualization (VIS)</h5>
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
					<th class="date">2022</th>
					<th>
						<h5 class="single">REU application reviewer</h5>
					</th>
				</tr>
				<tr>
					<th class="date">2020 - 2021</th>
					<th>
						<h5 class="single">PhD student faculty representative</h5>
					</th>
				</tr>
				<!-- PRESS -->
				<tr>
					<th class="date" />
					<th>
						<h4 class="header">Press & Talks</h4>
					</th>
				</tr>
				<tr>
					<th class="date">2021</th>
					<th>
						<h5 class="single press">
							<a href="https://youtu.be/fnr9XWvjJHw?t=1082">
								"Data Science Widgets with Svelte and Jupyter"
							</a>
							-
							<i>Svelte Summit 2021</i>
						</h5>
					</th>
				</tr>
				<tr>
					<th class="date">2020</th>
					<th>
						<h5 class="single press">
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
						<h5 class="single press">
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
						<h5 class="single press">
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
						<h5 class="single press">
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
						<h5 class="single press">
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
						<h5 class="single press">
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
						<h5 class="single press">
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
					<th class="date">2021</th>
					<th>
						<h5>Svelte + Vega</h5>
						<p class="desc">
							A Svelte component for reactively rendering Vega and Vega-Lite visualizations.
						</p>
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
						<p class="desc">
							A framework for creating reactive data science widgets using Svelte JS.
						</p>
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
						<p class="desc">
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
          <p class="desc">
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
          <p class="desc">
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
						<h5>PROX-1 Satellite</h5>
						<h6>Flight Software Lead and Researcher</h6>
						<p class="desc">
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
						<p class="desc">
							Guide and resources for capture the flag (CTF) competitions with over 1.4k stars on
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
          <p class="desc">
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
          <p class="desc">
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
          <p class="desc">
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
					<th class="date">PhD</th>
					<th>
						<a href="https://yonatanbisk.com/teaching/mmml-s22/">
							<h5 class="single">MultiModal Machine Learning</h5>
						</a>
						<h5 class="single">Causality and Machine Learning</h5>
						<h5 class="single">Human Judgement and Decision Making</h5>
						<a href="https://www.hcii.cmu.edu/courses/applied-research-methods">
							<h5 class="single">Applied Research Methods</h5>
						</a>
					</th>
				</tr>
				<tr class="item">
					<th class="date">B.S.</th>
					<th>
						<a href="https://www.cc.gatech.edu/classes/AY2019/cs7643_fall/">
							<h5 class="single">Deep Learning</h5>
						</a>
						<a href="http://poloclub.gatech.edu/cse6242/2018spring">
							<h5 class="single">Data and Visual Analytics</h5>
						</a>
						<a href="https://www.omscs.gatech.edu/cs-7641-machine-learning">
							<h5 class="single">Machine Learning</h5>
						</a>
						<a href="http://cx4230.gatech.edu/sp17/">
							<h5 class="single">Computer Simulation</h5>
						</a>
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
          <p class="desc">Last updated November 5, 2020.</p>
        </th>
      </tr> -->
			</table>
		</main>
	</div>
{/if}

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

	h5 {
		margin: 0px;
		font-size: 16px;
		font-weight: 500;
		line-height: 22px;
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
		height: 20px;
	}

	.date {
		width: 135px;
		padding-right: 20px;
		font-weight: 200;
		float: left;
		text-align: right;
		line-height: 22px;
	}

	.desc {
		color: RGBA(0, 0, 0, 0.7);
		font-size: 16px;
		font-weight: 100;
		line-height: 20px;
	}

	.item {
		margin-top: 10px;
		margin-bottom: 10px;
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
	.press a {
		color: black;
	}

	.press a:hover {
		color: var(--primary);
	}

	:global(.me-author-cv) {
		font-size: 16px;
	}
	:global(.author-cv) {
		font-size: 16px;
		color: rgba(0, 0, 0, 0.6);
	}
</style>
