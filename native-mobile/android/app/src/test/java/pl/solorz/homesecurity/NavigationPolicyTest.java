package pl.solorz.homesecurity;
import org.junit.Test;
import static org.junit.Assert.*;
public class NavigationPolicyTest {
 @Test public void preservesOwnerRoute() { assertTrue(NavigationPolicy.isPanel(NavigationPolicy.view("home"))); assertTrue(NavigationPolicy.view("recordings").contains("&mobileView=recordings")); assertTrue(NavigationPolicy.view("home").contains("?auth=login&")); }
 @Test public void rejectsImpersonationAndUnsafeSchemes() {
  for(String url:new String[]{"http://dominiksolorz.github.io/kamera/","https://dominiksolorz.github.io.evil.example/kamera/","https://dominiksolorz.github.io@evil.example/kamera/","https://evil.example@dominiksolorz.github.io/kamera/","https://dominiksolorz.github.io:444/kamera/","https://dominiksolorz.github.io/kamera/../outside","https://dominiksolorz.github.io/kamera/%2e%2e/outside", "file:///kamera/","javascript:alert(1)","https://dominiksolorz.github.io/kameraevil/"}) assertFalse(url,NavigationPolicy.isPanel(url));
 }
 @Test(expected=IllegalArgumentException.class) public void rejectsInjectedView() { NavigationPolicy.view("home&auth=register"); }
}
