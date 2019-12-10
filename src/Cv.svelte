<script>
  import Intro from "./components/Intro.svelte";
  import Social from "./components/Social.svelte";
  import Links from "./components/Links.svelte";
  import pubs from "./data/pubs.js";
  import { onMount } from "svelte";

  onMount(() => window.scrollTo(0, 0));
</script>

<style>
  #container {
    font-family: "Roboto";
    line-height: 1.2;
    max-width: 700px;
    margin: 0px auto;
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
    font-size: 18px;
    font-weight: 700;
  }
  h6 {
    font-size: 16px;
    font-style: italic;
    margin: 0px;
    margin-top: 3px;
    color: rgba(0, 0, 0, 0.7);
  }

  a h6 {
    font-style: none;
  }

  th {
    padding-bottom: 5px;
  }

  .tags {
    margin-top: 5px;
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
    line-height: 27px;
  }

  .desc {
    color: RGBA(0, 0, 0, 0.7);
    font-size: 16px;
    margin-top: 5px;
    margin-bottom: 7px;
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
  }

  .color {
    font-size: 30px;
  }

  .single {
    font-weight: 300;
    margin-bottom: 0px;
  }

  .fas {
    font-size: 16px;
    margin-right: 4px;
  }

  .fab {
    font-size: 16px;
    margin-right: 4px;
  }

  .far {
    font-size: 16px;
    margin-right: 4px;
  }

  .authors {
    font-style: normal;
  }
</style>

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
          <Social />

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
        <th class="date">
          August 2019
          <br />
          - Present
        </th>
        <th>
          <h5>PhD in Human-Computer Interaction (HCI)</h5>
          <h6>Carnegie Mellon University - Pittsburgh, PA</h6>
        </th>
      </tr>
      <tr class="buffer" />
      <tr class="item">
        <th class="date">
          August 2015
          <br />
          - May 2019
        </th>
        <th>
          <h5>B.S. in Computer Science</h5>
          <h6>Georgia Institute of Technology - Atlanta, GA</h6>
          <p class="desc">
            Concentration in intelligence and modeling/simulation. Minor in
            economics.
          </p>
        </th>
      </tr>
      <tr class="item">
        <th class="date">Fall 2017</th>
        <th>
          <h6>Sciences Po - Paris, France</h6>
          <p class="desc">
            Exchange program with a focus on economics and political science.
          </p>
        </th>
      </tr>
      <!-- AWARDS -->
      <tr>
        <th class="date" />
        <th>
          <h4 class="header">Awards and Fellowships</h4>
        </th>
      </tr>
      <tr class="item">
        <th class="date">May 2019</th>
        <th>
          <h5>
            National Science Foundation Graduate Research Fellowship (NSF GRFP)
          </h5>
          <p class="desc">
            Three-year graduate fellowship for independent research. Full
            tuition with an annual stipend of $34,000.
          </p>
          <div class="tags">
            <a href="https://www.nsfgrfp.org/">
              <button>
                <i class="fas fa-globe" />
                Website
              </button>
            </a>
          </div>
        </th>
      </tr>
      <tr class="buffer" />
      <tr class="item">
        <th class="date">May 2019</th>
        <th>
          <h5>Love Family Foundation Scholarship</h5>
          <p class="desc">
            Award for the undergraduate with the most outstanding scholastic
            record in the graduating class. Co-awarded the $10,000 scholarship.
          </p>
          <div class="tags">
            <a
              href="https://www.scs.gatech.edu/news/620748/college-computing-student-alex-cabrera-wins-love-family-foundation-scholarship">
              <button>
                <i class="fas fa-globe" />
                Announcement
              </button>
            </a>
          </div>
        </th>
      </tr>
      <tr class="buffer" />
      <tr class="item">
        <th class="date">
          August 2015
          <br />
          - May 2019
        </th>
        <th>
          <h5>Stamps President's Scholar</h5>
          <h6>Georgia Tech and the Stamps Family Charitable Foundation</h6>
          <p class="desc">
            Full ride scholarship with $15,000 in extracurricular funding
            awarded to 10 students (27,270 applicants).
          </p>
          <div class="tags">
            <a href="https://stampsps.gatech.edu/">
              <button>
                <i class="fas fa-globe" />
                Website
              </button>
            </a>
          </div>
        </th>
      </tr>
      <tr class="buffer" />
      <tr class="item">
        <th class="date">February 3, 2018</th>
        <th>
          <h5>The Data Open Datathon</h5>
          <h6>Correlation One and Citadel Securities</h6>
          <p class="desc">
            Placed third and won $2,500 for creating a supervised learning
            system that predicts dangerous road areas.
          </p>
          <div class="tags">
            <a
              href="https://www.cc.gatech.edu/news/602004/datathon-challenges-students-create-solutions-real-world-problems">
              <button>
                <i class="far fa-newspaper" />
                Press Release
              </button>
            </a>
          </div>
        </th>
      </tr>
      <!-- INDUSTRY -->
      <tr>
        <th class="date" />
        <th>
          <h4 class="header">Industry Experience</h4>
        </th>
      </tr>
      <tr class="item">
        <th class="date">
          May 2018
          <br />
          - August 2018
        </th>
        <th>
          <h5>Google</h5>
          <h6>Software Engineering Intern</h6>
          <p class="desc">
            Researched and prototyped improvements for automated driver
            assistance systems and hyperlocal weather prediction for the next
            generation of Android Auto.
          </p>
          <div class="tags">
            <a
              href="https://www.wsj.com/articles/google-to-partner-with-biggest-car-alliance-1537243260
              ">
              <button>
                <i class="far fa-newspaper" />
                WSJ Article
              </button>
            </a>
            <button>Android Auto</button>
            <button>Java</button>
            <button>C++</button>
            <button>Protocol Buffers</button>
          </div>
        </th>
      </tr>
      <tr class="buffer" />
      <tr class="item">
        <th class="date">
          May 2017
          <br />
          - August 2017
        </th>
        <th>
          <h5>Google</h5>
          <h6>Software Engineering Intern</h6>
          <p class="desc">
            Designed and implemented an anomaly detection and trend analysis
            system for Google's primary data processing pipelines.
          </p>
          <div class="tags">
            <button>Apache Beam/Cloud DataFlow</button>
            <button>Java</button>
            <button>C++</button>
            <button>SQL</button>
          </div>
        </th>
      </tr>
      <tr class="buffer" />
      <tr class="item">
        <th class="date">
          May 2016
          <br />
          - August 2016
        </th>
        <th>
          <h5>Google</h5>
          <h6>Engineering Practicum Intern</h6>
          <p class="desc">
            Built an analytics platform for monitoring and catching erroneous
            edits to Google Maps.
          </p>
          <div class="tags">
            <button>Go</button>
            <button>BigQuery</button>
            <button>JavaScript</button>
          </div>
        </th>
      </tr>
      <!-- RESEARCH -->
      <tr>
        <th class="date" />
        <th>
          <h4 class="header">Research Experience</h4>
        </th>
      </tr>
      <tr class="item">
        <th class="date">
          January 2018
          <br />
          - May 2019
        </th>
        <th>
          <h5>Polo Club of Data Science</h5>
          <h6>Undergraduate Researcher</h6>
          <p class="desc">
            Applying human computer interaction and visualization techniques to
            help people understand and design more equitable machine learning
            models.
          </p>
          <div class="tags">
            <a href="https://poloclub.github.io/">
              <button>
                <i class="fas fa-globe" />
                Polo Club
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
          - May 2017
        </th>
        <th>
          <h5>PROX-1 Satellite</h5>
          <h6>Flight Software Lead and Researcher</h6>
          <p class="desc">
            Led a team of engineers in developing and deploying the software for
            a fully undergraduate-led satellite mission.
          </p>
          <div class="tags">
            <a
              href="https://www.news.gatech.edu/2019/06/25/georgia-tech-satellite-successfully-launched-space">
              <button>
                <i class="fas fa-rocket" />
                In space!
              </button>
            </a>
            <a href="http://prox-1.gatech.edu/">
              <button>
                <i class="fas fa-globe" />
                Website
              </button>
            </a>
            <a
              href="https://www.ae.gatech.edu/news/2017/05/prox-1-launch-has-launched">
              <button>
                <i class="far fa-newspaper" />
                Press release
              </button>
            </a>
          </div>
        </th>
      </tr>
      <!-- PUBLICATIONS -->
      <tr>
        <th class="date" />
        <th>
          <h4 class="header">Publications</h4>
        </th>
      </tr>
      {#each pubs as pub}
        <tr class="item">
          <th class="date">{pub.month} {pub.year}</th>
          <th>
            <a href={'#/paper/' + pub.id} class="paper-title">
              <h5>{pub.title}</h5>
            </a>

            <h6 class="authors">
              {@html pub.authors
                .map(p => "<a href='" + p.website + "'>" + p.name + '</a>')
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
      <!-- PROJECTS -->
      <tr>
        <th class="date" />
        <th>
          <h4 class="header">Projects</h4>
        </th>
      </tr>
      <tr class="item">
        <th class="date">Fall 2018</th>
        <th>
          <h5>ICLR'19 Reproducibility Challenge</h5>
          <h6>
            Generative Adversarial Models for Learning Private and Fair
            Representations
          </h6>
          <p class="desc">
            Implemented the architecture and reproduced results for an ICLR'19
            submission using GANs to decorrelate sensitive data.
          </p>
          <div class="tags">
            <a href="https://github.com/cabreraalex/private-fair-GAN">
              <button>
                <i class="fab fa-github" />
                GitHub
              </button>
            </a>
          </div>
        </th>
      </tr>
      <tr class="buffer" />
      <tr class="item">
        <th class="date">Spring 2018</th>
        <th>
          <h5>Georgia Tech Bus System Analysis</h5>
          <p class="desc">
            System that combines Google Maps and graph algorithms to include
            Georgia Tech bus routes in navigation.
          </p>
          <div class="tags">
            <a href="./gt_bus_analysis.pdf">
              <button>
                <i class="fas fa-file-pdf" />
                Poster
              </button>
            </a>
            <a href="http://poloclub.gatech.edu/cse6242/2018spring/">
              <button>
                <i class="fas fa-globe" />
                Class
              </button>
            </a>
          </div>
        </th>
      </tr>
      <tr class="buffer" />
      <tr class="item">
        <th class="date">Spring 2014</th>
        <th>
          <h5>CTF Resources</h5>
          <p class="desc">
            Introductory guide and resources for capture the flag (CTF)
            competitions with over 900 stars on GitHub.
          </p>
          <div class="tags">
            <a href="http://ctfs.github.io/resources/">
              <button>
                <i class="fas fa-globe" />
                Website
              </button>
            </a>
            <a href="https://github.com/ctfs/resources">
              <button>
                <i class="fab fa-github" />
                GitHub
              </button>
            </a>
          </div>
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
        <th class="date">Fall 2016, Spring 2017, Spring 2018</th>
        <th>
          <h5>Undergraduate Teaching Assistant</h5>
          <h6>CS1332 - Data Structures and Algorithms</h6>
          <p class="desc">
            Taught a 1 1/2 hour weekly recitation, graded tests and homework,
            and helped create assignments.
          </p>
        </th>
      </tr>
      <tr class="buffer" />
      <tr class="item">
        <th class="date">Fall 2016</th>
        <th>
          <h5>Team Leader</h5>
          <h6>GT 1000 - First-Year Seminar</h6>
          <p class="desc">
            Designed a class curriculum for incoming first years and helped lead
            a weekly seminar class.
          </p>
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
          <h5>Student Volunteer</h5>
        </th>
      </tr>
      <tr>
        <th class="date">October 2019</th>
        <th>
          <h5 class="single">IEEE Visualization Conference (VIS)</h5>
        </th>
      </tr>
      <tr>
        <th class="date">January 2019</th>
        <th>
          <h5 class="single">
            ACM Fairness, Accountability, and Transparency (FAT*)
          </h5>
        </th>
      </tr>
      <br />
      <tr class="item">
        <th class="date" />
        <th>
          <h5>Reviewer</h5>
        </th>
      </tr>
      <tr>
        <th class="date">2019</th>
        <th>
          <h5 class="single">
            IEEE Transactions on Visualization and Computer Graphics (TVCG)
          </h5>
        </th>
      </tr>
      <!-- CAMPUS INVOLVEMENT -->
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
              <button>
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
              <button>
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
              <button>
                <i class="fas fa-globe" />
                Website
              </button>
            </a>
          </div>
        </th>
      </tr>
      <!-- SELECT CLASSES -->
      <tr>
        <th class="date" />
        <th>
          <h4 class="header">Selected Classes</h4>
        </th>
      </tr>
      <tr class="item">
        <th class="date">Fall 2018</th>
        <th>
          <a href="https://www.cc.gatech.edu/classes/AY2019/cs7643_fall/">
            <h5 class="single">CS 4803/7643 - Deep Learning</h5>
          </a>
        </th>
      </tr>
      <tr class="item">
        <th class="date">Spring 2018</th>
        <th>
          <a href="http://poloclub.gatech.edu/cse6242/2018spring">
            <h5 class="single">CX 4242/CSE 6242 - Data and Visual Analytics</h5>
          </a>
        </th>
      </tr>
      <tr class="item">
        <th class="date">Fall 2017</th>
        <th>
          <h5 class="single">BECO 1750A - Money and Banking</h5>
        </th>
      </tr>
      <tr class="item">
        <th class="date">Spring 2017</th>
        <th>
          <a href="https://www.omscs.gatech.edu/cs-7641-machine-learning">
            <h5 class="single">CS 4641/7641 - Machine Learning</h5>
          </a>
        </th>
      </tr>
      <tr class="item">
        <th class="date">Spring 2017</th>
        <th>
          <a href="http://cx4230.gatech.edu/sp17/">
            <h5 class="single">CX 4230 - Computer Simulation</h5>
          </a>
        </th>
      </tr>
      <tr class="item">
        <th class="date">Spring 2017</th>
        <th>
          <h5 class="single">CS 3511 - Honors Algorithms</h5>
        </th>
      </tr>
      <!-- SKILLS -->
      <tr>
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
            <button>English - Native</button>
            <button>Spanish - Native</button>
            <button>French - Conversational (B1)</button>
          </div>
        </th>
      </tr>
      <tr class="buffer" />
      <tr class="item">
        <th class="date" />
        <th>
          <h5>Programming Languages</h5>
          <div class="tags">
            <button>Java</button>
            <button>Javascript</button>
            <button>Python</button>
            <button>C/C++</button>
            <button>SQL</button>
            <button>Go</button>
          </div>
        </th>
      </tr>
      <tr class="buffer" />
      <tr class="item">
        <th class="date" />
        <th>
          <h5>Technologies</h5>
          <div class="tags">
            <button>Machine Learning</button>
            <button>Full Stack Development</button>
            <button>React</button>
            <button>Svelte</button>
            <button>Vega</button>
            <button>D3</button>
            <button>PyTorch</button>
            <button>Cloud Dataflow/MapReduce</button>
          </div>
        </th>
      </tr>
      <tr class="buffer" />
      <tr class="item">
        <th class="date" />
        <th>
          <p class="desc">Last updated November 1, 2019.</p>
        </th>
      </tr>
    </table>
  </main>
</div>
